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
const PLANS = join(ROOT, 'orchestration', 'plans');

const PLAN_STATES = new Set(['awaiting-criticism', 'awaiting-remediation', 'awaiting-recriticism', 'satisfied']);
function canonicalPlanState(id, statuses = []) {
  const status = [...statuses].sort((a, b) => roundOf(b.id) - roundOf(a.id))
    .find(r => PLAN_STATES.has(String(r.status.plan_state || '').toLowerCase()))?.status || {};
  const explicit = String(status.plan_state || '').toLowerCase();
  if (PLAN_STATES.has(explicit)) return explicit;
  const candidates = existsSync(PLANS) ? readdirSync(PLANS).filter(f => f.toLowerCase() === `${id}.md`.toLowerCase()) : [];
  if (!candidates.length) return 'needs-current-state-plan';
  const body = readFileSync(join(PLANS, candidates[0]), 'utf8');
  const marker = body.match(/^\s*(?:\*\*)?Plan-State:(?:\*\*)?\s*`?([a-z-]+)/im)?.[1]?.toLowerCase();
  return PLAN_STATES.has(marker) ? marker : 'awaiting-criticism';
}

const roundOf = id => Number(String(id).match(/-r(\d+)(?:-|$)/i)?.[1] || 0);
const withoutRound = id => String(id).replace(/-r\d+(?:-.*)?$/i, '');
const withoutWorkflowRole = id => String(id)
  .replace(/-(?:critic|judge|fix\d*|instrument)(?:-r\d+)?$/i, '')
  .replace(/-r\d+-(?:critic|judge|fix\d*|instrument)$/i, '');

/**
 * Resolve a historical task id to a logical continuation-planning unit.  A round marker is
 * workflow lineage only when repository evidence supplies a matching piece anchor.  This avoids
 * turning W1-04-r2/r3 into pieces while preserving names such as W1-PROSE-R2 when no W1-PROSE
 * piece exists.  A sole longer anchor handles histories whose first task had a descriptive name
 * (W1-17-act5-argument) and later rounds shortened it (W1-17-act5-r2).
 */
function canonicalPieceId(id, anchors, planAnchors = []) {
  const plannedParent = planAnchors
    .filter(x => id.toLowerCase() === x.toLowerCase() || id.toLowerCase().startsWith(`${x.toLowerCase()}-`))
    .sort((a, b) => b.length - a.length)[0];
  if (plannedParent) return plannedParent;
  const roleless = withoutWorkflowRole(id);
  const stem = withoutRound(roleless);
  const exact = anchors.find(x => x.toLowerCase() === stem.toLowerCase());
  if (exact) return exact;
  const descendants = anchors.filter(x => x.toLowerCase().startsWith(`${stem.toLowerCase()}-`));
  return descendants.length === 1 ? descendants[0] : id;
}

function canonicalPlanUnits(sourceRows, anchors, planAnchors = []) {
  const units = new Map();
  for (const row of sourceRows) {
    const id = canonicalPieceId(row.id, anchors, planAnchors);
    const key = id.toLowerCase();
    if (!units.has(key)) units.set(key, { id, history: [] });
    units.get(key).history.push(row);
  }
  return [...units.values()].map(unit => ({
    ...unit,
    planState: canonicalPlanState(unit.id, unit.history),
  }));
}

function planDispatchLabel(state) {
  return ({
    'needs-current-state-plan': 'needs current-state plan',
    'awaiting-criticism': 'plan awaiting criticism',
    'awaiting-remediation': 'plan has blocking criticism; awaiting remediation',
    'awaiting-recriticism': 'plan awaiting fresh re-criticism',
    satisfied: 'plan SATISFIED / build-ready',
  })[state];
}

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
    // Match a status file to a verdict the way verdict ids are actually written: on the
    // `w1-NN` (or `w1-<name>`) prefix, ignoring round numbers and the descriptive tail agents
    // append to their task ids. Keying on the whole id reported 91 pieces as unjudged, most of
    // which had verdicts under a shorter name — a number I published before checking it, which
    // is exactly the failure this project keeps charging builders for.
    const key = (id.toLowerCase().match(/^(w\d+-[a-z0-9]+)/) || [, id.toLowerCase()])[1];
    // A critic, a judge or a fix task is not a *piece*; nothing dispatches a critic against one.
    const isCritic = /(^|-)(critic|judge)(-|$)/.test(id.toLowerCase()) || /-fix$/.test(id.toLowerCase());
    rows.push({
      id, state, file: `orchestration/status/${f}`,
      next: String(j.next_step || '').slice(0, 80),
      complete: /complete/i.test(state),
      blocked: /blocked/i.test(state),
      hasVerdict: judged.has(key),
      isCritic, status: j,
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
if (process.argv.includes('--self-test')) {
  const expected = {
    'needs-current-state-plan': 'needs current-state plan',
    'awaiting-remediation': 'plan has blocking criticism; awaiting remediation',
    'awaiting-recriticism': 'plan awaiting fresh re-criticism',
    satisfied: 'plan SATISFIED / build-ready',
  };
  for (const [state, label] of Object.entries(expected)) {
    if (planDispatchLabel(state) !== label) throw new Error(`plan state ${state} did not classify`);
  }
  const fixture = [
    { id: 'W1-04', status: {} },
    { id: 'W1-04-r2', status: { plan_state: 'awaiting-remediation' } },
    { id: 'W1-04-r3', status: { plan_state: 'awaiting-recriticism' } },
    { id: 'W1-SOULS', status: {} },
    { id: 'W1-SOULS-LEDGER', status: { plan_state: 'satisfied' } },
    { id: 'W1-PROSE-R2', status: {} },
  ];
  const units = canonicalPlanUnits(fixture, fixture.map(r => r.id).filter(id => withoutRound(id) === id));
  const w104 = units.find(u => u.id === 'W1-04');
  if (!w104 || w104.history.length !== 3 || w104.planState !== 'awaiting-recriticism') {
    throw new Error('successive W1-04 rounds did not reconcile to the latest canonical state');
  }
  if (!units.some(u => u.id === 'W1-SOULS') || !units.some(u => u.id === 'W1-SOULS-LEDGER')) {
    throw new Error('distinct SOULS and SOULS-LEDGER work was incorrectly collapsed');
  }
  if (!units.some(u => u.id === 'W1-PROSE-R2')) throw new Error('unanchored R2 piece was blindly stripped');
  console.log('dispatchable self-test: canonical multi-round state and distinct-piece preservation PASS; no round counter exists.');
  process.exit(0);
}
if (process.argv.includes('--wave1-plans')) {
  const waveRows = rows.filter(r => /^w1-/i.test(r.id));
  const statusAnchors = waveRows.map(r => withoutWorkflowRole(r.id)).filter(id => withoutRound(id) === id);
  const verdictAnchors = [...judged].map(id => withoutRound(id));
  const planAnchors = existsSync(PLANS)
    ? readdirSync(PLANS).filter(f => /^w1-.*\.md$/i.test(f)).map(f => basename(f, '.md'))
    : [];
  const byLower = new Map();
  for (const id of [...statusAnchors, ...verdictAnchors, ...planAnchors]) {
    if (!byLower.has(id.toLowerCase())) byLower.set(id.toLowerCase(), id);
  }
  const wave = canonicalPlanUnits(waveRows, [...byLower.values()], planAnchors);
  for (const state of ['needs-current-state-plan', 'awaiting-criticism', 'awaiting-remediation', 'awaiting-recriticism', 'satisfied']) {
    const found = wave.filter(r => r.planState === state);
    if (!found.length) continue;
    console.log(`\n${planDispatchLabel(state)}  (${found.length})`);
    for (const r of found.sort((a,b) => a.id.localeCompare(b.id))) {
      const files = r.history.map(h => h.file).sort();
      console.log(`  ${r.id.padEnd(28)} ${files.length} status${files.length === 1 ? '' : 'es'}; reconstruct full history + current HEAD`);
      console.log(`    ${files.join(', ')}`);
    }
  }
  process.exit(0);
}
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
