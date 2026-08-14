#!/usr/bin/env node
// THE ROADMAP TRACKER — "how far through the roadmap are we, and is that number true?"
//
// Owner, verbatim: "I MUST always always have a way to instantly check how far through the
// roadmap we are, at any arbitrary point in time, and it must always be correct."
//
// "Always correct" is the whole point, so this file computes NOTHING it cannot check. It reads
// orchestration/roadmap.json — one FLAT list of items, each carrying a `phase` (A-F) rather than
// a second nesting level, because a hierarchy drifts out of sync with a document that keeps being
// hand-edited and a flat list with a tag does not — and, for every item claiming `done` or
// `in_progress`, VERIFIES every evidence entry it names:
//   - a `path` entry must exist on disk
//   - a `command` entry must exit with the stated code and (if given) its output must contain
//     the stated substring — every command in orchestration/roadmap.json is offline, no browser,
//     no GPU pod
//   - a `json_field` entry reads a JSON file and checks a field against a list of acceptable values
//
// A claim whose evidence does not verify is reported UNVERIFIED and does NOT count toward
// progress, however the item itself is labelled (rule: never invent progress). An item with no
// evidence array at all counts toward UNEVIDENCED regardless of its claimed state — Phase B-F is
// entirely `not_started` with `evidence: []` on purpose (ROADMAP.md deliberately drops resolution
// with distance) and the unevidenced count is the honest measure of how much of the full roadmap
// this tracker can currently see, not a defect to be minimised.
//
// PHASE A vs THE FULL ROADMAP. ROADMAP.md, in its own words: "Anyone quoting a completion
// percentage should quote it against this list [all of Phase A-F], not against Phase A, or it
// means nothing." So the headline percentage here is against every item, every phase. A Phase A
// figure is also printed, unmistakably labelled as a sub-total, because Phase A is the only part
// currently planned to step granularity and is what a returning reader usually wants next.
//
// Usage:
//   node tools/roadmap.mjs                 one-line answer + per-item table, writes docs/data/roadmap.json
//   node tools/roadmap.mjs --json           the full computed report as JSON, nothing written
//   node tools/roadmap.mjs --check-drift    ONLY the ROADMAP.md <-> roadmap.json drift check
//   node tools/roadmap.mjs --self-test      arms that must genuinely disagree (see bottom of file)
//
// Exit code: non-zero if ROADMAP.md and roadmap.json have drifted apart, or if a self-test arm
// fails. A normal run with UNVERIFIED items in it still exits 0 (like verdict-staleness.mjs — this
// is a reporting instrument the fleet runs constantly, not a gate that stops everyone else's commit
// on a fact about one item it does not own) but prints every UNVERIFIED claim loudly, because an
// unverifiable claim is more interesting than a true one.

import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import os from 'node:os';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
export const ROADMAP_JSON_PATH = 'orchestration/roadmap.json';
export const ROADMAP_MD_PATH = 'orchestration/ROADMAP.md';
export const SUMMARY_OUT_PATH = 'docs/data/roadmap.json';

// ---------------------------------------------------------------- evidence verification

/** Verify one evidence entry. Never throws — a bad entry is a finding, not a crash. */
function verifyEvidence(entry, root) {
  const base = { entry };
  if (!entry || typeof entry !== 'object' || !entry.type) {
    return { ...base, ok: false, reason: 'evidence entry has no "type"' };
  }
  try {
    if (entry.type === 'path') {
      if (!entry.path) return { ...base, ok: false, reason: 'path entry has no "path"' };
      const p = join(root, entry.path);
      const ok = existsSync(p);
      return { ...base, ok, reason: ok ? `exists: ${entry.path}` : `MISSING: ${entry.path}` };
    }
    if (entry.type === 'command') {
      if (!entry.cmd) return { ...base, ok: false, reason: 'command entry has no "cmd"' };
      const expectExit = typeof entry.expect_exit === 'number' ? entry.expect_exit : 0;
      let out = '', exitCode = 0;
      try {
        out = execSync(entry.cmd, { cwd: root, encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e) {
        exitCode = typeof e.status === 'number' ? e.status : 1;
        out = (e.stdout || '') + (e.stderr || '');
      }
      let ok = exitCode === expectExit;
      let reason = ok ? `exit ${exitCode} as expected` : `exit ${exitCode}, expected ${expectExit}`;
      if (ok && entry.contains) {
        const has = out.includes(entry.contains);
        ok = has;
        reason = has ? `exit ${exitCode}, output contains "${entry.contains}"` : `exit ${exitCode} but output did NOT contain "${entry.contains}"`;
      }
      return { ...base, ok, reason };
    }
    if (entry.type === 'json_field') {
      if (!entry.path || !entry.field) return { ...base, ok: false, reason: 'json_field entry needs "path" and "field"' };
      const p = join(root, entry.path);
      if (!existsSync(p)) return { ...base, ok: false, reason: `MISSING: ${entry.path}` };
      let j;
      try { j = JSON.parse(readFileSync(p, 'utf8')); }
      catch (e) { return { ...base, ok: false, reason: `${entry.path} is not valid JSON — ${e.message}` }; }
      const val = entry.field.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), j);
      const acceptable = Array.isArray(entry.one_of) ? entry.one_of : (entry.equals !== undefined ? [entry.equals] : null);
      if (!acceptable) return { ...base, ok: false, reason: 'json_field entry needs "one_of" or "equals"' };
      const ok = acceptable.includes(val);
      return { ...base, ok, reason: ok ? `${entry.path}#${entry.field} = ${JSON.stringify(val)}` : `${entry.path}#${entry.field} = ${JSON.stringify(val)}, expected one of ${JSON.stringify(acceptable)}` };
    }
    return { ...base, ok: false, reason: `unknown evidence type "${entry.type}"` };
  } catch (e) {
    return { ...base, ok: false, reason: `threw while checking: ${e.message}` };
  }
}

/**
 * Verify one flat item against its own claimed state. Returns the CLAIMED state, the VERIFIED
 * (effective) classification, and per-entry detail. This is the function the self-test exercises.
 */
export function verifyItem(item, { root = ROOT } = {}) {
  const claimed = item.state || 'not_started';
  const evidence = Array.isArray(item.evidence) ? item.evidence : [];
  const hasEvidence = evidence.length > 0;
  const results = evidence.map(e => verifyEvidence(e, root));
  const allOk = hasEvidence && results.every(r => r.ok);

  let effective, verified, counts;
  if (!hasEvidence) {
    // No evidence defined at all. This is tracked SEPARATELY from the claimed state (below) —
    // an item can be `not_started` (the honest, expected case for unplanned Phase B-F work) or
    // `done`/`in_progress` (a claim nobody can currently check) and both are "unevidenced" in the
    // sense that matters: the tracker cannot see them. `not_started` items keep their own label
    // because "not started, and nothing to evidence yet" is not a red flag; a `done`/`in_progress`
    // claim with nothing behind it is, so THAT case is relabelled `unevidenced` outright.
    effective = claimed === 'not_started' ? 'not_started' : 'unevidenced';
    verified = claimed === 'not_started';
    counts = false;
  } else if (claimed === 'not_started') {
    effective = 'not_started'; verified = true; counts = false;
  } else if (allOk) {
    effective = claimed; verified = true; counts = claimed === 'done';
  } else {
    effective = 'UNVERIFIED'; verified = false; counts = false;
  }

  return {
    id: item.id, phase: item.phase || '?', title: item.title,
    claimed_state: claimed, effective_state: effective,
    has_evidence: hasEvidence, verified, counts_as_done: counts,
    evidence_results: results, failing_evidence: results.filter(r => !r.ok),
    unevidenced_note: item.unevidenced_note || null,
    closes_when: item.closes_when || null,
    visible_outcome: item.visible_outcome || null,
  };
}

export function loadRoadmap(root = ROOT) {
  const p = join(root, ROADMAP_JSON_PATH);
  if (!existsSync(p)) throw new Error(`${ROADMAP_JSON_PATH} does not exist at ${root}`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

const PHASE_LABELS = {
  A: 'Foundations you can see (in flight, planned to the step)',
  B: 'The Morrowind half',
  C: 'The Souls half',
  D: 'The world',
  E: 'The whole thing',
  F: 'The bar itself',
};

/** The full computed report: every item verified, progress computed only from verified `done` items. */
export function computeReport(roadmap, { root = ROOT } = {}) {
  const rawItems = Array.isArray(roadmap.items) ? roadmap.items : [];
  const standing = Array.isArray(roadmap.standing_work) ? roadmap.standing_work : [];

  const items = rawItems.map(it => verifyItem(it, { root }));
  const standingReports = standing.map(s => verifyItem(s, { root }));

  const total = items.length;
  const done = items.filter(u => u.counts_as_done).length;
  const unverified = items.filter(u => u.effective_state === 'UNVERIFIED').length;
  const unevidenced = items.filter(u => !u.has_evidence).length; // ALL phases, any state — the honest visibility measure
  const inProgress = items.filter(u => u.effective_state === 'in_progress').length;
  const notStarted = items.filter(u => u.effective_state === 'not_started').length;
  const blocked = items.filter(u => u.effective_state === 'blocked').length;

  // Per-phase sub-totals — Phase A is reported unmistakably as a SUB-total, never as THE figure.
  const phases = [...new Set(items.map(i => i.phase))].sort();
  const byPhase = phases.map(p => {
    const ps = items.filter(i => i.phase === p);
    const pd = ps.filter(i => i.counts_as_done).length;
    return {
      phase: p, label: PHASE_LABELS[p] || p,
      total: ps.length, done: pd,
      pct: ps.length ? Math.round((1000 * pd) / ps.length) / 10 : 0,
      unevidenced: ps.filter(i => !i.has_evidence).length,
    };
  });

  // "Current item" for the one-liner: first item (roadmap order) not verified done.
  const current = items.find(u => !u.counts_as_done) || items[items.length - 1] || null;

  const pct = total ? Math.round((1000 * done) / total) / 10 : 0;

  return {
    generated_commit: gitHead(root),
    total_items: total, done_items: done, in_progress_items: inProgress,
    not_started_items: notStarted, blocked_items: blocked,
    unverified_items: unverified, unevidenced_items: unevidenced,
    pct_done: pct,
    current_item: current ? { id: current.id, title: current.title, phase: current.phase } : null,
    by_phase: byPhase,
    items,
    standing_work: standingReports,
  };
}

function gitHead(root) {
  try { return execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim(); }
  catch { return null; }
}

// ---------------------------------------------------------------- drift check
// Two sources of truth that can disagree silently is the exact defect this project keeps finding.
// ROADMAP.md's prose is authoritative for WHAT we are doing; roadmap.json mirrors its items. If an
// item exists in one and not the other, or titles diverge outright, that is a finding to fail
// loudly on. ROADMAP.md is hand-edited and will keep being hand-edited (its prose carries
// reasoning phase-generation would flatten), so this check — not a markdown generator — is the
// mechanism that keeps the two from disagreeing silently.
export function checkDrift(roadmap, { root = ROOT, mdPath = ROADMAP_MD_PATH } = {}) {
  const problems = [];
  const p = join(root, mdPath);
  if (!existsSync(p)) return { ok: false, problems: [`${mdPath} does not exist`] };
  const md = readFileSync(p, 'utf8');

  // Phase A: "## Step 1 — Surfaces respond to light *(in progress)*" / "## Step 2b — ...".
  const stepHeadingRe = /^##\s+Step\s+(\d+[a-z]?)\s*[—–-]\s*(.+?)(?:\s*\*\([^)]*\)\*)?\s*$/gmi;
  const mdSteps = new Map(); // token ("1","2b") -> title
  let m;
  while ((m = stepHeadingRe.exec(md))) mdSteps.set(m[1].toLowerCase(), m[2].trim());

  // Phase B-F: "- **B1 Journal and quest-telling.** ..." / "- **C2 Weapons and movesets** with...".
  const phaseItemRe = /^- \*\*([A-F]\d+)\s+(.+?)\*\*/gm;
  const mdPhaseItems = new Map(); // token lowercased ("b1") -> title
  while ((m = phaseItemRe.exec(md))) mdPhaseItems.set(m[1].toLowerCase(), m[2].trim().replace(/\.$/, ''));

  const items = Array.isArray(roadmap.items) ? roadmap.items : [];
  const jsonStepTokens = new Map(); // "1","2b" -> {title,id}
  const jsonPhaseTokens = new Map(); // "b1" -> {title,id}

  for (const it of items) {
    if (it.phase === 'A') {
      const token = (it.id.match(/^step-(\d+[a-z]?)$/i) || [, null])[1];
      if (!token) { problems.push(`roadmap.json item "${it.id}" is phase A but its id does not match "step-<N[letter]>"`); continue; }
      jsonStepTokens.set(token.toLowerCase(), { title: it.title, id: it.id });
    } else {
      const token = (it.id.match(/^phase-([a-f]\d+)$/i) || [, null])[1];
      if (!token) { problems.push(`roadmap.json item "${it.id}" is phase ${it.phase} but its id does not match "phase-<letter><N>"`); continue; }
      jsonPhaseTokens.set(token.toLowerCase(), { title: it.title, id: it.id });
    }
  }

  // Loose title comparison throughout: a title that has PLAINLY diverged (no overlap at all in
  // either direction) is the thing worth failing on; a trailing clause difference is not — an
  // exact-string requirement would make this brittle against harmless rewording upstream.
  const titlesDiverge = (a, b) => {
    a = a.toLowerCase(); b = b.toLowerCase();
    return !a.includes(b) && !b.includes(a);
  };

  for (const [token, entry] of jsonStepTokens) {
    // step-2c has no "## Step 2c" heading yet — ROADMAP.md introduces it only as prose inside
    // step 2b's section ("that is a separate step (2c) done at the GENERATOR"). Fall back to a
    // loose textual mention rather than demanding a heading that does not exist yet, or this
    // check would fail on the exact kind of honest, in-flight authoring it should tolerate.
    if (!mdSteps.has(token)) {
      const mentioned = new RegExp(`\\(${token}\\)|\\bstep\\s*${token}\\b`, 'i').test(md);
      if (!mentioned) problems.push(`roadmap.json has "${entry.id}" (${entry.title}) but ROADMAP.md never mentions step ${token} (no heading, no "(${token})")`);
      continue;
    }
    const mdTitle = mdSteps.get(token);
    if (titlesDiverge(mdTitle, entry.title)) problems.push(`title drift on step ${token}: ROADMAP.md says "${mdTitle}", roadmap.json says "${entry.title}"`);
  }
  for (const [token, title] of mdSteps) {
    if (!jsonStepTokens.has(token)) problems.push(`ROADMAP.md has "## Step ${token} — ${title}" but roadmap.json has no phase-A item with that token`);
  }

  for (const [token, entry] of jsonPhaseTokens) {
    if (!mdPhaseItems.has(token)) { problems.push(`roadmap.json has "${entry.id}" (${entry.title}) but ROADMAP.md has no "**${token.toUpperCase()} ...**" bullet`); continue; }
    const mdTitle = mdPhaseItems.get(token);
    if (titlesDiverge(mdTitle, entry.title)) problems.push(`title drift on ${token.toUpperCase()}: ROADMAP.md says "${mdTitle}", roadmap.json says "${entry.title}"`);
  }
  for (const [token, title] of mdPhaseItems) {
    if (!jsonPhaseTokens.has(token)) problems.push(`ROADMAP.md has "**${token.toUpperCase()} ${title}**" but roadmap.json has no item with that token`);
  }

  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------- printing
function badge(state) {
  if (state === 'done') return '[DONE]      ';
  if (state === 'in_progress') return '[in progress]';
  if (state === 'not_started') return '[not started]';
  if (state === 'blocked') return '[BLOCKED]   ';
  if (state === 'UNVERIFIED') return '[UNVERIFIED]';
  if (state === 'unevidenced') return '[unevidenced]';
  return `[${state}]`;
}

export function printReport(report) {
  const lines = [];
  lines.push(`ROADMAP (full list, all phases): ${report.done_items}/${report.total_items} verified DONE (${report.pct_done}%) as of ${report.generated_commit || 'unknown commit'}` +
    `${report.current_item ? ` — currently on ${report.current_item.id} [phase ${report.current_item.phase}] (${report.current_item.title})` : ''}.` +
    `${report.unverified_items ? ` ${report.unverified_items} UNVERIFIED claim(s).` : ''}` +
    ` ${report.unevidenced_items} unevidenced (no evidence defined at all — the honest measure of how much this tracker can currently see).`);
  const a = report.by_phase.find(p => p.phase === 'A');
  if (a) lines.push(`  sub-total, Phase A only (foundations in flight — NOT the whole roadmap): ${a.done}/${a.total} (${a.pct}%)`);
  lines.push('');
  lines.push('id             phase  state          title');
  lines.push('-'.repeat(80));
  for (const r of report.items) {
    lines.push(`${r.id.padEnd(14)} ${String(r.phase).padEnd(6)} ${badge(r.effective_state).padEnd(14)} ${r.title}`);
    if (r.effective_state === 'UNVERIFIED') {
      for (const f of r.failing_evidence) lines.push(`               -> FAILED: ${f.reason}`);
    }
    if (r.effective_state === 'unevidenced') {
      lines.push(`               -> claims "${r.claimed_state}" with no evidence defined` + (r.unevidenced_note ? ` — ${r.unevidenced_note}` : ''));
    }
  }
  lines.push('');
  lines.push('by phase:');
  for (const p of report.by_phase) lines.push(`  ${p.phase}  ${p.label.padEnd(56)} ${p.done}/${p.total} (${p.pct}%)  ${p.unevidenced} unevidenced`);
  lines.push('');
  lines.push('standing work (not counted toward the percentage above — no closing condition by design):');
  for (const r of report.standing_work) {
    lines.push(`${r.id.padEnd(28)} ${badge(r.effective_state).padEnd(14)} ${r.title}`);
    if (r.effective_state === 'UNVERIFIED') for (const f of r.failing_evidence) lines.push(`             -> FAILED: ${f.reason}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------- docs/data/roadmap.json
export function writeSummary(report, { root = ROOT, outPath = SUMMARY_OUT_PATH } = {}) {
  const summary = {
    schema: 'elder-souls/roadmap-summary@2',
    generated_at: new Date().toISOString(),
    commit: report.generated_commit,
    total_items: report.total_items, done_items: report.done_items,
    in_progress_items: report.in_progress_items, not_started_items: report.not_started_items,
    blocked_items: report.blocked_items, unverified_items: report.unverified_items,
    unevidenced_items: report.unevidenced_items,
    pct_done: report.pct_done,
    current_item: report.current_item,
    by_phase: report.by_phase,
    items: report.items.map(it => ({
      id: it.id, phase: it.phase, title: it.title, visible_outcome: it.visible_outcome,
      claimed_state: it.claimed_state, effective_state: it.effective_state,
      closes_when: it.closes_when, has_evidence: it.has_evidence,
      failing_evidence: it.failing_evidence.map(f => f.reason),
      unevidenced_note: it.unevidenced_note,
    })),
    standing_work: report.standing_work.map(s => ({
      id: s.id, title: s.title, claimed_state: s.claimed_state, effective_state: s.effective_state,
      failing_evidence: s.failing_evidence.map(f => f.reason),
    })),
  };
  mkdirSync(dirname(join(root, outPath)), { recursive: true });
  writeFileSync(join(root, outPath), JSON.stringify(summary, null, 2));
  return summary;
}

// ---------------------------------------------------------------- self-test
// Rule 4: a probe that cannot fail is worse than no probe. Every arm below is required to
// DISAGREE with at least one sibling arm, or the suite declares itself vacuous rather than
// reporting a false PASS. Built on an isolated temp fixture — never on real repo evidence — so
// this can delete files without touching anything another agent owns.
export function selfTest() {
  const tmp = mkdtempSync(join(os.tmpdir(), 'roadmap-selftest-'));
  const results = [];
  const rec = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(40)} ${detail}`); };

  try {
    writeFileSync(join(tmp, 'proof.txt'), 'evidence present');
    mkdirSync(join(tmp, 'sub'), { recursive: true });
    writeFileSync(join(tmp, 'sub', 'status.json'), JSON.stringify({ state: 'done' }));

    // Arm A — done + evidence present -> must count.
    const stepDoneOk = { id: 'step-1', phase: 'A', title: 'done, evidence present', state: 'done', evidence: [{ type: 'path', path: 'proof.txt' }] };
    const a = verifyItem(stepDoneOk, { root: tmp });
    rec('A:done+evidence-present-counts', a.effective_state === 'done' && a.counts_as_done === true, `effective=${a.effective_state} counts=${a.counts_as_done}`);

    // Arm B — same claim, evidence file REMOVED -> must report UNVERIFIED and NOT count. Required
    // to disagree with A: same input state, opposite ground truth, opposite answer.
    rmSync(join(tmp, 'proof.txt'));
    const b = verifyItem(stepDoneOk, { root: tmp });
    rec('B:done+evidence-removed-UNVERIFIED', b.effective_state === 'UNVERIFIED' && b.counts_as_done === false, `effective=${b.effective_state} counts=${b.counts_as_done}`);
    rec('A/B genuinely disagree', a.effective_state !== b.effective_state, `A=${a.effective_state} B=${b.effective_state}`);
    writeFileSync(join(tmp, 'proof.txt'), 'evidence present again');

    // Arm C — not_started -> must never count, evidence or not.
    const stepNotStarted = { id: 'phase-b1', phase: 'B', title: 'not started', state: 'not_started', evidence: [] };
    const c = verifyItem(stepNotStarted, { root: tmp });
    rec('C:not_started-never-counts', c.effective_state === 'not_started' && c.counts_as_done === false, `effective=${c.effective_state} counts=${c.counts_as_done}`);

    // Arm D — done, but NO evidence defined at all -> `unevidenced`, distinct from done and
    // UNVERIFIED, and distinct from a not_started item's own (also unevidenced-by-count) state.
    const stepNoEvidence = { id: 'step-2', phase: 'A', title: 'done, no evidence field', state: 'done', evidence: [] };
    const d = verifyItem(stepNoEvidence, { root: tmp });
    rec('D:done+no-evidence-is-unevidenced', d.effective_state === 'unevidenced' && d.counts_as_done === false && d.has_evidence === false, `effective=${d.effective_state} counts=${d.counts_as_done} has_evidence=${d.has_evidence}`);
    rec('D differs from A and B', d.effective_state !== a.effective_state && d.effective_state !== b.effective_state, `D=${d.effective_state} A=${a.effective_state} B=${b.effective_state}`);
    rec('C and D both have_evidence=false but differ in label', c.has_evidence === false && d.has_evidence === false && c.effective_state !== d.effective_state, `C=${c.effective_state}(not_started) D=${d.effective_state}(done claim)`);

    // Arm E — command evidence: true vs false must disagree.
    const cmdOkStep = { id: 'step-3', phase: 'A', title: 'command evidence, true', state: 'done', evidence: [{ type: 'command', cmd: `grep -q "evidence present" proof.txt`, expect_exit: 0 }] };
    const cmdBadStep = { id: 'step-4', phase: 'A', title: 'command evidence, false', state: 'done', evidence: [{ type: 'command', cmd: `grep -q "this string is not in the file" proof.txt`, expect_exit: 0 }] };
    const e1 = verifyItem(cmdOkStep, { root: tmp });
    const e2 = verifyItem(cmdBadStep, { root: tmp });
    rec('E:command-evidence-true-counts', e1.counts_as_done === true, `effective=${e1.effective_state}`);
    rec('E:command-evidence-false-UNVERIFIED', e2.effective_state === 'UNVERIFIED' && e2.counts_as_done === false, `effective=${e2.effective_state}`);
    rec('E1/E2 genuinely disagree', e1.effective_state !== e2.effective_state, `E1=${e1.effective_state} E2=${e2.effective_state}`);

    // Arm F — json_field evidence: terminal state passes; wrong state fails.
    const jfStep = { id: 'step-5', phase: 'A', title: 'json_field evidence', state: 'done', evidence: [{ type: 'json_field', path: 'sub/status.json', field: 'state', one_of: ['done', 'complete'] }] };
    const f1 = verifyItem(jfStep, { root: tmp });
    rec('F:json_field-terminal-state-counts', f1.counts_as_done === true, `effective=${f1.effective_state}`);
    writeFileSync(join(tmp, 'sub', 'status.json'), JSON.stringify({ state: 'building' }));
    const f2 = verifyItem(jfStep, { root: tmp });
    rec('F:json_field-wrong-state-UNVERIFIED', f2.effective_state === 'UNVERIFIED' && f2.counts_as_done === false, `effective=${f2.effective_state}`);
    rec('F1/F2 genuinely disagree', f1.effective_state !== f2.effective_state, `F1=${f1.effective_state} F2=${f2.effective_state}`);

    // Arm G — computeReport progress on a flat fixture: one verifiable-done item of two is 50%,
    // and removing its evidence must move the SAME fixture to 0%.
    writeFileSync(join(tmp, 'g-proof.txt'), 'ok');
    const fixtureRoadmap = {
      items: [
        { id: 'step-1', phase: 'A', title: 'X', state: 'done', evidence: [{ type: 'path', path: 'g-proof.txt' }] },
        { id: 'phase-b1', phase: 'B', title: 'Y', state: 'not_started', evidence: [] },
      ],
      standing_work: [],
    };
    const g1 = computeReport(fixtureRoadmap, { root: tmp });
    rec('G:2-item-fixture-50pct', g1.total_items === 2 && g1.done_items === 1 && g1.pct_done === 50, `total=${g1.total_items} done=${g1.done_items} pct=${g1.pct_done}`);
    rmSync(join(tmp, 'g-proof.txt'));
    const g2 = computeReport(fixtureRoadmap, { root: tmp });
    rec('G:same-fixture-evidence-removed-0pct', g2.done_items === 0 && g2.pct_done === 0, `done=${g2.done_items} pct=${g2.pct_done}`);
    rec('G1/G2 genuinely disagree', g1.pct_done !== g2.pct_done, `G1=${g1.pct_done} G2=${g2.pct_done}`);
    rec('G:unevidenced counts the not_started item too', g1.unevidenced_items === 1, `unevidenced=${g1.unevidenced_items}`);

    // Arm H — drift check, Phase A headings: a title that has plainly diverged must be caught;
    // matching titles must pass clean.
    writeFileSync(join(tmp, 'ROADMAP.md'), '## Step 1 — Surfaces respond to light *(in progress)*\n\nsome prose\n\n## Step 2 — The first five minutes\n\n- **B1 Journal and quest-telling.** prose here.\n');
    const driftBadStep = { items: [{ id: 'step-1', phase: 'A', title: 'Surfaces respond to light' }, { id: 'step-2', phase: 'A', title: 'A completely unrelated sentence about a dragon' }, { id: 'phase-b1', phase: 'B', title: 'Journal and quest-telling' }] };
    const driftGoodStep = { items: [{ id: 'step-1', phase: 'A', title: 'Surfaces respond to light' }, { id: 'step-2', phase: 'A', title: 'The first five minutes' }, { id: 'phase-b1', phase: 'B', title: 'Journal and quest-telling' }] };
    const h1 = checkDrift(driftBadStep, { root: tmp, mdPath: 'ROADMAP.md' });
    const h2 = checkDrift(driftGoodStep, { root: tmp, mdPath: 'ROADMAP.md' });
    rec('H:drift-detected-title-diverges', h1.ok === false && h1.problems.length > 0, `ok=${h1.ok} problems=${h1.problems.length}`);
    rec('H:no-drift-when-titles-match', h2.ok === true, `ok=${h2.ok} problems=${JSON.stringify(h2.problems)}`);
    rec('H1/H2 genuinely disagree', h1.ok !== h2.ok, `H1=${h1.ok} H2=${h2.ok}`);

    // Arm I — drift check, Phase B-F bullet: a missing phase item (present in MD, absent from
    // roadmap.json) must be caught.
    const driftMissingPhaseItem = { items: [{ id: 'step-1', phase: 'A', title: 'Surfaces respond to light' }, { id: 'step-2', phase: 'A', title: 'The first five minutes' }] };
    const i1 = checkDrift(driftMissingPhaseItem, { root: tmp, mdPath: 'ROADMAP.md' });
    rec('I:drift-detected-phase-item-missing-from-json', i1.ok === false && i1.problems.some(p => /B1/.test(p)), `ok=${i1.ok} problems=${JSON.stringify(i1.problems)}`);
    rec('I/H2 genuinely disagree', i1.ok !== h2.ok, `I=${i1.ok} H2=${h2.ok}`);

  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const failed = results.filter(r => !r.ok);
  console.log('');
  console.log(`${results.length - failed.length}/${results.length} self-test checks passed.`);
  if (failed.length) {
    console.log('FAILED (the suite is not vacuous — these are real failures, not a design choice):');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  }
  return failed.length === 0;
}

// ---------------------------------------------------------------- CLI
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    const ok = selfTest();
    process.exit(ok ? 0 : 1);
  }

  const roadmap = loadRoadmap(ROOT);

  if (args.includes('--check-drift')) {
    const d = checkDrift(roadmap, { root: ROOT });
    if (d.ok) { console.log('roadmap.mjs --check-drift: ROADMAP.md and roadmap.json agree on every step id and phase-item token.'); process.exit(0); }
    console.error(`roadmap.mjs --check-drift: ${d.problems.length} disagreement(s) between ROADMAP.md and roadmap.json:`);
    for (const p of d.problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  const report = computeReport(roadmap, { root: ROOT });

  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  console.log(printReport(report));

  const drift = checkDrift(roadmap, { root: ROOT });
  if (!drift.ok) {
    console.error('');
    console.error(`DRIFT: ROADMAP.md and orchestration/roadmap.json disagree (${drift.problems.length}):`);
    for (const p of drift.problems) console.error(`  - ${p}`);
  } else {
    console.log('');
    console.log('drift check: ROADMAP.md and roadmap.json agree.');
  }

  const summary = writeSummary(report, { root: ROOT });
  console.log('');
  console.log(`wrote ${SUMMARY_OUT_PATH} (${summary.done_items}/${summary.total_items} done, ${summary.pct_done}% of the FULL roadmap)`);

  process.exitCode = drift.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error('roadmap.mjs: fatal —', e.stack || e.message); process.exitCode = 1; });
}
