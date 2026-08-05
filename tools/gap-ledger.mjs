#!/usr/bin/env node
/**
 * gap-ledger.mjs — regenerate the gap ledger from every verdict.
 *
 * Inputs   corpus/90-verdicts/<wave>/*.json   (verdicts, VERDICT-SCHEMA.md)
 * Outputs  corpus/90-verdicts/GAP-LEDGER.json  canonical, machine-readable
 *          corpus/90-verdicts/GAP-LEDGER.md    human view of the same data
 *
 * NEVER hand-edit either output. A gap is opened by a verdict's `biggest_gap` and closed
 * by a LATER verdict's `gap_closure[]` — written by a critic, never by the agent that
 * built the fix (SCORING.md §5). Closures marked `closed_by_builder_of_fix: true` are
 * rejected here, loudly.
 *
 * Usage
 *   node tools/gap-ledger.mjs
 *   node tools/gap-ledger.mjs --check    do not write; exit 1 if stale
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const VERDICT_DIR = join(ROOT, 'corpus', '90-verdicts');
const OUT_JSON = join(VERDICT_DIR, 'GAP-LEDGER.json');
const OUT_MD = join(VERDICT_DIR, 'GAP-LEDGER.md');
const CHECK_ONLY = process.argv.includes('--check');

const rel = (p) => relative(ROOT, p).split(sep).join('/');
mkdirSync(VERDICT_DIR, { recursive: true });

// ------------------------------------------------------------ load verdicts
const verdicts = [];
const loadErrors = [];
for (const waveDir of readdirSync(VERDICT_DIR)) {
  const wd = join(VERDICT_DIR, waveDir);
  if (!statSync(wd).isDirectory()) continue;
  for (const f of readdirSync(wd)) {
    if (!f.endsWith('.json')) continue;
    if (f === 'COHERENCE.json') continue;
    const p = join(wd, f);
    try {
      const v = JSON.parse(readFileSync(p, 'utf8'));
      if (v.kind === 'coherence') continue;
      verdicts.push({ ...v, _file: rel(p) });
    } catch (e) {
      loadErrors.push({ file: rel(p), message: String(e.message || e) });
    }
  }
}
verdicts.sort((a, b) => (a.wave - b.wave) || String(a.piece_id).localeCompare(String(b.piece_id)));

const maxWave = verdicts.reduce((m, v) => Math.max(m, Number(v.wave) || 0), 0);

// --------------------------------------------------------------- open gaps
const ledger = new Map();   // gap_id -> entry
const warnings = [];

for (const v of verdicts) {
  const g = v.biggest_gap;
  if (!g) {
    warnings.push(`${v._file}: verdict has no biggest_gap — VOID per ARBITRATION.md §3 ("a critic that reports no gap found has failed its own job").`);
    continue;
  }
  if (ledger.has(g.gap_id)) {
    warnings.push(`${v._file}: duplicate gap_id ${g.gap_id} (already opened by ${ledger.get(g.gap_id).opened_in}).`);
    continue;
  }
  const acceptance = g.remedy && g.remedy.acceptance ? String(g.remedy.acceptance) : '';
  if (!/\d|<=|>=|<|>|zero|none|every|all |per /i.test(acceptance)) {
    warnings.push(`${g.gap_id}: remedy.acceptance has no number or observable condition — not re-measurable, verdict should be PROVISIONAL (SCORING.md §4).`);
  }
  ledger.set(g.gap_id, {
    gap_id: g.gap_id,
    subsystem_path: g.subsystem_path,
    opened_wave: v.wave,
    opened_by: v.critic && v.critic.run_id,
    opened_in: v._file,
    piece_id: v.piece_id,
    severity: g.severity || 'major',
    what: g.what,
    why_it_matters: g.why_it_matters,
    remedy: g.remedy,
    evidence: g.evidence || [],
    status: 'open',
    assigned_to_wave: (Number(v.wave) || 0) + 1,
    closure: { closed_wave: null, closed_by: null, measured_value: null, evidence: [], note: null },
    superseded_by: null,
    age_waves: 0,
  });
}

// ------------------------------------------------------------- apply closures
for (const v of verdicts) {
  for (const c of v.gap_closure || []) {
    const e = ledger.get(c.gap_id);
    if (!e) { warnings.push(`${v._file}: gap_closure references unknown gap_id ${c.gap_id}.`); continue; }
    if (c.closed_by_builder_of_fix) {
      warnings.push(`REJECTED CLOSURE ${c.gap_id} in ${v._file}: closed_by_builder_of_fix=true. A gap cannot be closed by the agent that built the fix (SCORING.md §5 rule 1). Gap stays open.`);
      continue;
    }
    if (v.wave <= e.opened_wave) {
      warnings.push(`${v._file}: closure of ${c.gap_id} is in the same wave (${v.wave}) that opened it. Closure must come from a later wave's critic. Ignored.`);
      continue;
    }
    e.status = c.status;
    e.closure = {
      closed_wave: v.wave,
      closed_by: v.critic && v.critic.run_id,
      measured_value: c.measured_value ?? null,
      evidence: c.evidence || [],
      note: c.note || null,
    };
    if (c.status === 'superseded') e.superseded_by = c.superseded_by || null;
  }
}

for (const e of ledger.values()) {
  const until = e.closure.closed_wave ?? maxWave;
  e.age_waves = Math.max(0, (Number(until) || 0) - (Number(e.opened_wave) || 0));
  if (e.status !== 'closed' && e.severity === 'blocking' && e.age_waves >= 3) {
    warnings.push(`ESCALATE ${e.gap_id}: blocking gap open for ${e.age_waves} waves on \`${e.subsystem_path}\`. Per SCORING.md §5 rule 6, either the remedy is wrong or the piece needs a rebuild, not a patch.`);
  }
}

const entries = [...ledger.values()].sort(
  (a, b) => (a.opened_wave - b.opened_wave) || String(a.gap_id).localeCompare(String(b.gap_id)),
);
const open = entries.filter((e) => e.status === 'open' || e.status === 'partially-closed');
const byPath = new Map();
for (const e of open) {
  if (!byPath.has(e.subsystem_path)) byPath.set(e.subsystem_path, []);
  byPath.get(e.subsystem_path).push(e);
}

const doc = {
  schema_version: 1,
  generated: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  generator: 'tools/gap-ledger.mjs',
  waves_seen: [...new Set(verdicts.map((v) => v.wave))].sort((a, b) => a - b),
  verdicts_read: verdicts.length,
  counts: {
    total: entries.length,
    open: entries.filter((e) => e.status === 'open').length,
    partially_closed: entries.filter((e) => e.status === 'partially-closed').length,
    closed: entries.filter((e) => e.status === 'closed').length,
    superseded: entries.filter((e) => e.status === 'superseded').length,
    invalid: entries.filter((e) => e.status === 'invalid').length,
  },
  open_by_subsystem_path: Object.fromEntries([...byPath].map(([k, v]) => [k, v.map((e) => e.gap_id)])),
  warnings,
  load_errors: loadErrors,
  gaps: entries,
};

// ------------------------------------------------------------------- render md
const M = [];
M.push('# GAP LEDGER');
M.push('');
M.push('> **GENERATED FILE — DO NOT HAND-EDIT.** Regenerate with `node tools/gap-ledger.mjs`.');
M.push('> Canonical data: `corpus/90-verdicts/GAP-LEDGER.json`. Source: every verdict\'s');
M.push('> `biggest_gap` (opens) and `gap_closure[]` (closes). Rules: `SCORING.md` §5.');
M.push('');
M.push(`Generated: ${doc.generated} · verdicts read: ${doc.verdicts_read} · waves: ${doc.waves_seen.join(', ') || '(none)'}`);
M.push('');
M.push('**The three rules that matter**');
M.push('1. Every verdict opens exactly one gap. A verdict with no gap is void.');
M.push('2. A gap is closed only by a **later wave\'s critic**, re-measuring the gap\'s own');
M.push('   `acceptance` condition — **never** by the agent that built the fix.');
M.push('3. Every open gap on a subsystem path is handed to that path\'s next builder **up');
M.push('   front**, as required work (`BUILDER-PROMPT-TEMPLATE.md`).');
M.push('');
M.push(`| total | open | partially-closed | closed | superseded | invalid |`);
M.push('|---:|---:|---:|---:|---:|---:|');
M.push(`| ${doc.counts.total} | ${doc.counts.open} | ${doc.counts.partially_closed} | ${doc.counts.closed} | ${doc.counts.superseded} | ${doc.counts.invalid} |`);
M.push('');

M.push('## Open gaps — required work for the next wave');
M.push('');
if (open.length === 0) {
  M.push(entries.length === 0
    ? '_No verdicts have been filed yet. This ledger fills itself as critics emit verdicts into `corpus/90-verdicts/<wave>/<piece_id>.json`._'
    : '_No open gaps. Verify this against SCORING.md §4 before believing it — a ledger that empties faster than it fills usually means soft critics, not a finished game._');
} else {
  M.push('| Gap | Subsystem path | Sev | Age (waves) | Opened | What | Remedy → acceptance |');
  M.push('|---|---|---|---:|---|---|---|');
  for (const e of open) {
    const r = e.remedy || {};
    M.push(`| \`${e.gap_id}\` | \`${e.subsystem_path}\` | ${e.severity} | ${e.age_waves} | w${e.opened_wave} / ${e.piece_id} | ${oneLine(e.what)} | ${oneLine(r.action)} → **${oneLine(r.acceptance)}** |`);
  }
}
M.push('');

M.push('## Open gaps grouped by subsystem path (the builder hand-off)');
M.push('');
if (byPath.size === 0) M.push('_None._');
else {
  for (const [p, list] of [...byPath].sort()) {
    M.push(`- \`${p}\` — ${list.map((e) => `\`${e.gap_id}\``).join(', ')}`);
  }
}
M.push('');

M.push('## Closed and superseded');
M.push('');
const done = entries.filter((e) => !open.includes(e));
if (done.length === 0) M.push('_None yet._');
else {
  M.push('| Gap | Subsystem path | Status | Opened | Closed | Measured | Closed by |');
  M.push('|---|---|---|---|---|---|---|');
  for (const e of done) {
    M.push(`| \`${e.gap_id}\` | \`${e.subsystem_path}\` | ${e.status} | w${e.opened_wave} | ${e.closure.closed_wave !== null ? 'w' + e.closure.closed_wave : '—'} | ${e.closure.measured_value ?? '—'} | ${e.closure.closed_by || '—'} |`);
  }
}
M.push('');

M.push('## Warnings');
M.push('');
if (warnings.length === 0 && loadErrors.length === 0) M.push('_None._');
else {
  for (const w of warnings) M.push(`- ${w}`);
  for (const e of loadErrors) M.push(`- UNPARSEABLE \`${e.file}\`: ${e.message}`);
}
M.push('');

function oneLine(s) {
  return String(s ?? '—').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
}

const jsonOut = JSON.stringify(doc, null, 2) + '\n';
const mdOut = M.join('\n');

if (CHECK_ONLY) {
  const strip = (s) => s.replace(/"generated": "[^"]*"/, '').replace(/^Generated: .*$/m, '');
  const staleJson = !existsSync(OUT_JSON) || strip(readFileSync(OUT_JSON, 'utf8')) !== strip(jsonOut);
  const staleMd = !existsSync(OUT_MD) || strip(readFileSync(OUT_MD, 'utf8')) !== strip(mdOut);
  if (staleJson || staleMd) { console.error('GAP-LEDGER is STALE. Run: node tools/gap-ledger.mjs'); process.exit(1); }
  console.log('GAP-LEDGER is up to date.');
} else {
  writeFileSync(OUT_JSON, jsonOut);
  writeFileSync(OUT_MD, mdOut);
  console.log(`Wrote ${rel(OUT_JSON)} and ${rel(OUT_MD)}`);
}

console.log(`  verdicts read : ${verdicts.length}`);
console.log(`  gaps total    : ${doc.counts.total} (open ${doc.counts.open}, partial ${doc.counts.partially_closed}, closed ${doc.counts.closed})`);
console.log(`  warnings      : ${warnings.length}`);
for (const w of warnings) console.log(`  ! ${w}`);
for (const e of loadErrors) console.log(`  ! unparseable ${e.file}: ${e.message}`);
