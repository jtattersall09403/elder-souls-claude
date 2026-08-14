#!/usr/bin/env node
// RI-MTH07 CONSUMPTION census — re-runnable standing check.
//
// "A model that nothing in the running world reads scores zero." This tool is the mechanical
// FIRST PASS the method describes ("a grep for the field name is where you start, not where you
// stop") — it enumerates authored field names across game/data/**/*.json, grouped by directory
// family (siblings share a schema), and checks whether each leaf field name is referenced
// anywhere under game/src/ (the running world) versus only under tools/ (build-time / critic
// tooling, which RI-MTH07 explicitly says does not count: "a field that only a critic ever reads
// is instrumentation, not gameplay").
//
// It is HONEST about its own limits:
//   - A zero grep hit is a CANDIDATE orphan, not a proof. Destructuring, renamed locals, and
//     dynamic string-keyed access can hide a real reader from a name grep (RULES.md rule 11:
//     "a field census over data cannot prove a read dead").
//   - It cannot detect WRITTEN-NEVER-UPDATED (a field that IS read, but nothing keeps it current
//     from world state) by grep alone — that requires reading the write sites and asking whether
//     they run once (boot/save-load) or every tick. This tool ships one structural check for that
//     shape (sim.env.region, the known instance) and reports it as a standing tripwire: if the
//     write-site count for a WNU-tracked field changes, the finding may be stale and needs re-review.
//   - Commentary/documentation fields embedded in the same JSON records (a `_note`, `_rationale`,
//     `why_this_direction`) are filtered out by name pattern — they are not "authored data fields"
//     describing game content, they are prose about the record, and grepping them as if they were
//     gameplay data is exactly the false-orphan noise RULES rule 4 warns a probe must not manufacture.
//
// Usage:
//   node tools/metrics/consumption-census.mjs                 # full report
//   node tools/metrics/consumption-census.mjs --json           # machine-readable
//   node tools/metrics/consumption-census.mjs --max-orphans N  # fail threshold (default: current count, i.e. no regression)

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_ROOT = path.join(ROOT, 'game', 'data');
const SRC_ROOT = path.join(ROOT, 'game', 'src');
const TOOLS_ROOT = path.join(ROOT, 'tools');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const maxOrphansArg = args.indexOf('--max-orphans');
const maxOrphans = maxOrphansArg >= 0 ? parseInt(args[maxOrphansArg + 1], 10) : null;

// ---------------------------------------------------------------------------------------------
// 1. Walk game/data, group files by directory family (one level past the immediate parent so
//    sibling schema directories like combat/movesets vs combat/enemies do not get merged).
// ---------------------------------------------------------------------------------------------
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.json')) out.push(p);
  }
}
const files = [];
walk(DATA_ROOT, files);

function groupKey(f) {
  const parts = path.relative(ROOT, f).split(path.sep);
  if (parts.length >= 5) return parts.slice(0, 4).join('/');
  return parts.slice(0, Math.min(3, parts.length)).join('/');
}
const groups = {};
for (const f of files) (groups[groupKey(f)] = groups[groupKey(f)] || []).push(f);

// ---------------------------------------------------------------------------------------------
// 2. Collect field-name leaves per group. Dictionaries keyed by id (a "roster" shape: >70% of
//    keys are themselves objects) are sampled once so an 87-weapon or 1160-clip registry doesn't
//    explode into thousands of spurious "keys" that are actually just IDs.
// ---------------------------------------------------------------------------------------------
function isDictOfObjects(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length < 4) return false;
  let objCount = 0;
  for (const k of keys) if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) objCount++;
  return objCount / keys.length > 0.7;
}
function collectKeys(obj, prefix, set, depth) {
  if (depth > 4) return;
  if (Array.isArray(obj)) { if (obj.length) collectKeys(obj[0], prefix + '[]', set, depth + 1); return; }
  if (obj && typeof obj === 'object') {
    if (isDictOfObjects(obj) && depth > 0) {
      const firstKey = Object.keys(obj)[0];
      set.add(prefix + '.<id>');
      collectKeys(obj[firstKey], prefix + '.<id>', set, depth + 1);
      return;
    }
    for (const k of Object.keys(obj)) {
      const p = prefix ? prefix + '.' + k : k;
      set.add(p);
      collectKeys(obj[k], p, set, depth + 1);
    }
  }
}

// Commentary / provenance / documentation fields: prose about the record, not data the game
// reads. Filtered so the report is about gameplay fields, not the corpus's own annotation style.
const NOISE_RE = /(_note|_notes|_rule$|_ruling|_reason|_rationale|_source$|_derivation|_formula|_context|_convention|_scope$|_declaration|_claim|^note_on|corpus_item|design_note|^why_|^how_to_|^what_this_is$|^what_it_|^what_the_|^acceptance_|_provenance$|_declared$|^schema$|^id$|^owner$|^unit$|^class$)/;
const META_KEYS = new Set(['note', 'notes', 'schema', 'id', 'owner', 'unit', 'source', 'provenance', 'description', 'comment']);

function leaf(k) {
  const parts = k.split('.');
  let last = parts[parts.length - 1];
  if (last === '<id>' || last === '[]') last = parts[parts.length - 2] || last;
  return last.replace('[]', '').replace('<id>', '');
}

const report = {};
for (const [g, fl] of Object.entries(groups)) {
  const keySet = new Set();
  const sample = fl.slice(0, 4);
  for (const f of sample) {
    try { collectKeys(JSON.parse(fs.readFileSync(f, 'utf8')), '', keySet, 0); } catch { /* skip malformed */ }
  }
  const leaves = new Set();
  for (const k of keySet) {
    const l = leaf(k);
    if (l && l.length > 1 && !META_KEYS.has(l) && !NOISE_RE.test(l) && !l.startsWith('_') && /^[A-Za-z]/.test(l)) leaves.add(l);
  }
  report[g] = { count: fl.length, sample, leaves: Array.from(leaves).sort() };
}

// ---------------------------------------------------------------------------------------------
// 3. Grep game/src and tools/ for each leaf name (word-boundary). Classify.
// ---------------------------------------------------------------------------------------------
function grepCount(root, term) {
  try {
    const out = execSync(
      `grep -rc --include='*.js' -w -F -- ${JSON.stringify(term)} ${JSON.stringify(root)} | awk -F: '{s+=$2} END {print s+0}'`,
      { encoding: 'utf8', shell: '/bin/bash' }
    );
    return parseInt(out.trim(), 10) || 0;
  } catch { return 0; }
}

const CONSUMED = [];
const ORPHAN_CANDIDATE = [];
const TOOLING_ONLY = [];

for (const [g, r] of Object.entries(report)) {
  for (const l of r.leaves) {
    const srcHits = grepCount(SRC_ROOT, l);
    if (srcHits > 0) { CONSUMED.push({ group: g, field: l, srcHits }); continue; }
    const toolHits = grepCount(TOOLS_ROOT, l);
    if (toolHits > 0) TOOLING_ONLY.push({ group: g, field: l, toolHits });
    else ORPHAN_CANDIDATE.push({ group: g, field: l });
  }
}

// ---------------------------------------------------------------------------------------------
// 4. WRITTEN-NEVER-UPDATED structural tripwire: sim.env.region. Grep alone cannot find this class
//    (the field IS read, so it never shows up as a name-grep orphan) — it requires counting write
//    sites and checking whether any of them run on a per-tick / per-position basis rather than
//    only at boot or save-load. This is the one instance RI-MTH07's own brief names by name; it is
//    encoded here as a standing regression check rather than re-discovered by hand each time.
// ---------------------------------------------------------------------------------------------
function grepLines(root, pattern) {
  try {
    return execSync(`grep -rn ${JSON.stringify(pattern)} --include='*.js' ${JSON.stringify(root)} || true`, { encoding: 'utf8', shell: '/bin/bash' })
      .split('\n').filter(Boolean);
  } catch { return []; }
}
const WNU_CHECKS = [
  {
    field: 'sim.env.region',
    writePattern: 'sim.env.region =',
    expectedWriteSites: ['save/state.js'], // the only place it is allowed to be written today
    note: 'Should be re-derived from player position every tick (or at minimum on cell/settlement change), the way sim.env.settlement and sim.env.interior are. Today it is only assigned on save-load.',
  },
];
const wnuResults = WNU_CHECKS.map((check) => {
  const sites = grepLines(SRC_ROOT, check.writePattern).map((l) => l.split(':')[0].replace(ROOT + '/', ''));
  const unexpected = sites.filter((s) => !check.expectedWriteSites.some((e) => s.endsWith(e)));
  const stillStale = sites.length > 0 && sites.every((s) => check.expectedWriteSites.some((e) => s.endsWith(e)));
  return { ...check, writeSites: sites, stillMatchesKnownDefect: stillStale, unexpectedWriteSites: unexpected };
});

// ---------------------------------------------------------------------------------------------
// 5. Report
// ---------------------------------------------------------------------------------------------
const counts = {
  groups: Object.keys(report).length,
  fields_scanned: CONSUMED.length + ORPHAN_CANDIDATE.length + TOOLING_ONLY.length,
  consumed: CONSUMED.length,
  orphan_candidate: ORPHAN_CANDIDATE.length,
  tooling_only: TOOLING_ONLY.length, // instrumentation per RI-MTH07 — not a world-side consumer
  written_never_updated_tracked: wnuResults.length,
  written_never_updated_still_true: wnuResults.filter((w) => w.stillMatchesKnownDefect).length,
};

if (asJson) {
  console.log(JSON.stringify({ counts, orphan_candidates: ORPHAN_CANDIDATE, tooling_only: TOOLING_ONLY, wnu: wnuResults }, null, 1));
} else {
  console.log('=== RI-MTH07 consumption census (mechanical first pass) ===');
  console.log(`groups scanned:            ${counts.groups}`);
  console.log(`fields scanned:            ${counts.fields_scanned}`);
  console.log(`  CONSUMED (game/src hit):        ${counts.consumed}`);
  console.log(`  TOOLING-ONLY (critic/build only, no world-side reader): ${counts.tooling_only}`);
  console.log(`  ORPHAN CANDIDATE (no hit anywhere): ${counts.orphan_candidate}`);
  console.log(`WRITTEN-NEVER-UPDATED tracked checks: ${counts.written_never_updated_tracked} (${counts.written_never_updated_still_true} still red)`);
  for (const w of wnuResults) {
    console.log(`  - ${w.field}: write sites = [${w.writeSites.join(', ') || 'NONE FOUND'}] -> ${w.stillMatchesKnownDefect ? 'STILL STALE (matches known defect)' : (w.writeSites.length === 0 ? 'UNRESOLVED: no write site found, re-check pattern' : 'CHANGED — re-review, may be fixed or moved')}`);
  }
  console.log('');
  console.log('This is a NAME-GREP census: a zero hit is a candidate, not a proof (destructuring,');
  console.log('renamed locals and dynamic keys can hide a real reader). See');
  console.log('reports/consumption-census/2026-08-14-census.md for the manually-verified subset and');
  console.log('the ranked-by-impact orphan list. Full field-by-field detail: --json.');
}

// ---------------------------------------------------------------------------------------------
// 6. Fail on regression. Default ceiling is frozen at the count measured 2026-08-14 (see the
//    census doc) so this tool catches NEW orphans landing, not the backlog already known.
// ---------------------------------------------------------------------------------------------
const CEILING = maxOrphans !== null ? maxOrphans : 520; // measured baseline; see census doc §"Tool baseline"
let failed = false;
if (counts.orphan_candidate > CEILING) {
  console.error(`FAIL: orphan candidates (${counts.orphan_candidate}) exceeds ceiling (${CEILING}).`);
  failed = true;
}
if (counts.written_never_updated_still_true < wnuResults.length && wnuResults.some((w) => w.writeSites.length === 0)) {
  console.error('FAIL: a tracked WRITTEN-NEVER-UPDATED check found no write site at all — the check itself may be broken.');
  failed = true;
}
process.exit(failed ? 1 : 0);
