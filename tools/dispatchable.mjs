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

/**
 * The verdict-lookup key for a status row's task id.
 *
 * ORCHESTRATION/AUDITS/UNJUDGED-TRIAGE-2026-08-14.md found the defect this replaces:
 * `/^(w\d+-[a-z0-9]+)/` stops at the FIRST hyphen after the `w<N>` segment, so a multi-word piece
 * id was looked up under its first word only — `W1-LIBRARY-MARTIAL` as `w1-library`,
 * `W1-ATTR-SCALE` as `w1-attr`, `W1-PROSE-TICS` as `w1-prose` — none of which exists, so all three
 * (and others) reported unjudged while their own verdict sat on disk under their full name.
 *
 * The fix strips ONLY a genuine trailing round marker (`-r<N>` at the very end of the string —
 * nothing after it) and otherwise keeps every hyphen, so the key is the piece's FULL name, matched
 * for exact equality against `judgedPieces()`'s set (which is built the same way, from each
 * verdict's own `piece_id`, minus its own trailing round).
 *
 * WHAT THIS DELIBERATELY DOES NOT DO, per the triage's own naming of the dangerous direction: it
 * does NOT fall back to prefix or "sole descendant" matching when no exact key exists. `W1-23` and
 * `province-stream-pump` are two real examples this leaves reporting unjudged, because their
 * verdicts are filed under a materially different piece_id (`w1-23-lore-registry-and-the-
 * provinces-canon`, `w1-01-province-stream-pump`) that the task id is not a full, exact match for
 * even once round-stripped. Widening this to "task id is a hyphen-bounded prefix of the verdict's
 * piece_id" would look tempting and IS the trap: `W1-08` — a real, separate, currently-
 * `awaiting-recriticism` task — is a hyphen-bounded prefix of `w1-08-w1-29`, the piece_id of the
 * JOINT W1-08/W1-29 verdict `W1-08-W1-29-r2.json`. Prefix-matching would report standalone W1-08
 * as already judged by a verdict that in fact judges W1-08 and W1-29 TOGETHER — exactly the
 * "w1-08 matching w1-08-w1-29" shape the triage warned against, and it is not hypothetical: W1-08
 * is a live task_id in `orchestration/status/` today. Exact-match-only is the one design that
 * cannot manufacture that collision, at the cost of leaving W1-23 and province-stream-pump
 * genuinely unresolved by this tool (they were already resolved once, by hand, in the triage's
 * §1d — that is a fine division of labour: this tool answers the common case cheaply and exactly,
 * a human/agent reads the odd one out).
 *
 * A trailing `-r<N>` is a round ONLY when nothing follows it. `W1-01-province-stream-r1` looks
 * like a round of `W1-01` but its own verdict's piece_id is `w1-01-province-stream-pump` — a
 * SUB-PIECE, not a round — and this function does not fold multi-hyphen names down toward any
 * shorter existing anchor the way `canonicalPieceId()` above does for plan-state reconciliation;
 * it only ever removes the exact trailing `-r<N>` suffix, so a sub-piece's extra words survive
 * into its key intact and it is never mistaken for a round of something shorter.
 */
function verdictLookupKey(id) {
  const lower = String(id).toLowerCase();
  const withoutTrailingRound = lower.replace(/-r\d+$/, '');
  const wholeIdIsAPieceName = withoutTrailingRound.match(/^(w\d+(?:-[a-z0-9]+)*)$/);
  return wholeIdIsAPieceName ? wholeIdIsAPieceName[1] : lower;
}

const judged = judgedPieces();
const rows = [];
if (existsSync(STATUS)) {
  for (const f of readdirSync(STATUS).filter(f => f.endsWith('.json'))) {
    let j; try { j = JSON.parse(readFileSync(join(STATUS, f), 'utf8')); } catch { continue; }
    const id = j.task_id || basename(f, '.json');
    const state = String(j.state || 'unknown');
    const key = verdictLookupKey(id);
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

  // ---- verdictLookupKey() arms, per orchestration/audits/UNJUDGED-TRIAGE-2026-08-14.md --------
  // HAZARDS.md §0: a self-test whose arms all fabricate the same disputed input proves nothing
  // about that input. The disputed input here is the shape of the REAL status/verdict corpus, so
  // every arm below reads it — `judged` (built above from the real corpus/90-verdicts tree) and
  // real `orchestration/status/*.json` task ids — rather than a hand-rolled fixture that could
  // share the implementation's own false premise. Each arm names the file it depends on so a
  // future corpus change that breaks the fixture fails LOUDLY here instead of going quiet.
  const need = (bool, msg) => { if (!bool) throw new Error(`verdictLookupKey self-test: FAILED — ${msg}`); };

  // Arm 1 — a multi-hyphen piece WITH a verdict must read judged. Break it on purpose: the OLD
  // regex (`/^(w\d+-[a-z0-9]+)/`) truncates 'w1-library-martial' to 'w1-library' and this fails,
  // which is the exact defect the triage found (score 5.4 on disk, reported unjudged).
  need(existsSync(join(VERDICTS, 'wave1', 'W1-LIBRARY-MARTIAL-r4.json')),
    "fixture corpus/90-verdicts/wave1/W1-LIBRARY-MARTIAL-r4.json is gone — update this arm's fixture");
  need(verdictLookupKey('W1-LIBRARY-MARTIAL') === 'w1-library-martial', "key for W1-LIBRARY-MARTIAL should be the full name, not truncated at the first hyphen");
  need(judged.has(verdictLookupKey('W1-LIBRARY-MARTIAL')), 'W1-LIBRARY-MARTIAL has a verdict on disk (score 5.4) and must read judged');

  // Arm 2 — a multi-hyphen piece WITHOUT a verdict must read unjudged. W1-GIVER-PRESENCE is one of
  // the triage's sixteen genuinely-unjudged pieces (§2 row 3); no verdict exists under any name.
  need(existsSync(join(STATUS, 'W1-GIVER-PRESENCE.json')), "fixture orchestration/status/W1-GIVER-PRESENCE.json is gone — update this arm's fixture");
  need(!judged.has(verdictLookupKey('W1-GIVER-PRESENCE')), 'W1-GIVER-PRESENCE has no verdict anywhere and must read unjudged, not borrow a neighbour\'s');

  // Arm 3 — a piece must NOT match a neighbour's verdict. `W1-08` is a real, separate, live
  // task_id (orchestration/status/W1-08.json, plan_state awaiting-recriticism) with no verdict of
  // its OWN; the only verdict anywhere near it is W1-08-W1-29-r2.json, piece_id 'w1-08-w1-29' —
  // judging W1-08 and W1-29 TOGETHER. Prefix-matching (the tempting wider fix) would report W1-08
  // as judged by that joint verdict; this is the dangerous direction the triage named and this arm
  // is the falsifier for it.
  need(existsSync(join(STATUS, 'W1-08.json')), "fixture orchestration/status/W1-08.json is gone — update this arm's fixture");
  need(judged.has('w1-08-w1-29'), "fixture corpus/90-verdicts/wave1/W1-08-W1-29-r2.json is gone or renamed — update this arm's fixture");
  need(verdictLookupKey('W1-08') === 'w1-08', "key for W1-08 must be exactly 'w1-08', not swept into a longer neighbour's name");
  need(!judged.has(verdictLookupKey('W1-08')), "W1-08 must NOT read judged off the joint W1-08/W1-29 verdict — that is the w1-08-vs-w1-08-w1-29 trap");

  // Arm 4 — a sub-piece must not be mistaken for a round. `W1-17-act5-r2` LOOKS like round 2 of
  // `W1-17`, and W1-17 itself does have a verdict (W1-17-r1.json, piece_id 'w1-17', score 5) — an
  // unrelated piece that a naive "strip to the W1-NN prefix" reading would wrongly credit round 2
  // with. The real predecessor is W1-17-act5-r1.json, piece_id 'w1-17-act5-argument' (FAIL 3/10),
  // a different key entirely, and round 2 (responding to that fail) has no verdict of its own yet.
  need(existsSync(join(STATUS, 'W1-17-act5-r2.json')), "fixture orchestration/status/W1-17-act5-r2.json is gone — update this arm's fixture");
  need(judged.has('w1-17'), "fixture corpus/90-verdicts/wave1/W1-17-r1.json is gone or renamed — update this arm's fixture");
  const act5r2Key = verdictLookupKey('W1-17-act5-r2');
  need(act5r2Key !== verdictLookupKey('W1-17'), "W1-17-act5-r2 must not collapse to plain W1-17's key");
  need(!judged.has(act5r2Key), "W1-17-act5-r2 must not be credited with plain W1-17's verdict (score 5) -- it is a different piece, and its own round 2 is not yet judged");

  console.log('dispatchable self-test: verdictLookupKey PASS (4/4) — multi-hyphen resolves to its own verdict, absent stays unjudged, no neighbour collision, no sub-piece-as-round.');
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
