#!/usr/bin/env node
// w1-21-r3-empty.mjs — RULES 6, FOR THE INSTRUMENT: run every graded check with its subject
// removed and confirm that none of them goes green.
//
// W1-21 round 3. The round-2 verdict's acceptance clause, verbatim:
//
//   "every check in `ui-layer.mjs`, `ui-forbidden.mjs`, `marker-diff.mjs`, `ui-metrics.mjs` and
//    `ui-census.mjs` emits a sample count and returns `EMPTY` rather than `PASS` when it is zero,
//    **demonstrated by running each with its subject removed and confirming none of them goes
//    green**"
//
// TWO ARMS, because rule 6 distinguishes an inert fix from an inert control and this run has to
// be able to tell them apart:
//
//   ARM A — THE FIX PRESENT. Each detector is run with `--teardown`: it measures nothing at all,
//     on purpose, and every check must come back `EMPTY` (never `PASS`) with the tool exiting 2.
//     None of these six runs launches a browser, which is deliberate — a control that costs a
//     browser is a control somebody skips under contention, and contention is why round 2's three
//     edited detectors shipped unrun.
//
//   ARM B — THE FIX DELETED. The round-2 grading expressions are transcribed here, character for
//     character from `37bbb6f`, and evaluated over the SAME empty sample sets. If they do not all
//     come back `true`, then the guard added this round was not what changed the answer and this
//     whole exercise is a second copy of arm A. **This is the arm that must go red**, and it does:
//     all 12 transcribed expressions return PASS on nothing.
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { parseArgs, wantsHelp, usage, log, RUNS_DIR, REPO_ROOT, ensureDir, writeJson } from '../lib/cli.mjs';

const USAGE = `
w1-21-r3-empty.mjs — every graded check, with its subject removed.

USAGE
  node tools/ui/w1-21-r3-empty.mjs [--out <dir>] [--json]

EXIT 0 = no check went green on an empty sample set, and the round-2 control DID · 1 = otherwise
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const RUN = path.join(RUNS_DIR, String(args.out || 'W1-21-R3'));
ensureDir(RUN);

// `--out` means a DIRECTORY to every tool here except marker-scan.mjs, where it is a FILE, so
// marker-scan is run without one rather than being handed a path it would resolve differently.
const TOOLS = [
  ['ui-metrics.mjs', 'tools/metrics/ui-metrics.mjs', 'UI-METRICS', true],
  ['ui-forbidden.mjs', 'tools/analysis/ui-forbidden.mjs', 'UI-FORBIDDEN', true],
  ['ui-layer.mjs', 'tools/analysis/ui-layer.mjs', 'UI-LAYER', true],
  ['marker-diff.mjs', 'tools/analysis/marker-diff.mjs', 'MARKER-DIFF', true],
  ['marker-scan.mjs', 'tools/analysis/marker-scan.mjs', 'MARKER-SCAN', false],
  ['ui-census.mjs', 'tools/analysis/ui-census.mjs', 'UI-CENSUS', true],
];

// ---- ARM A: the fix present -------------------------------------------------------------------
const armA = [];
for (const [name, rel, outdir, dirOut] of TOOLS) {
  let stdout = '', code = 0;
  try {
    stdout = execFileSync('node', [rel, '--teardown', ...(dirOut ? ['--out', `W1-21-R3-TEARDOWN/${outdir}`] : [])],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { stdout = String(e.stdout || '') + String(e.stderr || ''); code = e.status; }
  const rows = [...stdout.matchAll(/^\[harness\]\s+(PASS|FAIL|EMPTY|PARTIAL)\s+(\S+)/gm)]
    .map((m) => ({ status: m[1], id: m[2] }));
  armA.push({ tool: name, exit: code, checks: rows });
  const green = rows.filter((r) => r.status === 'PASS');
  log(`  ${name.padEnd(20)} exit ${code}  ${rows.length} checks: `
    + `${rows.filter((r) => r.status === 'EMPTY').length} EMPTY, ${green.length} PASS `
    + `[${rows.map((r) => `${r.id}=${r.status}`).join(' ')}]`);
}

// ---- ARM B: the round-2 expressions, over the same nothing ------------------------------------
//
// Transcribed from `37bbb6f`. Each is evaluated with the empty inputs a teardown run produces.
const captures = [];                    // ui-metrics `out.captures` after a run that captured none
const differentials = [];               // marker-diff `out.differentials`
const yawSweep = [];                    // marker-diff `out.yaw_sweep`
const results = [];                     // ui-layer `results`
const instrument = [];                  // ui-layer `instrument`
const barContrasts = {};                // ui-census `o.bar_contrasts`
const unknownKinds = [];                // ui-census `o.unknown_kinds`
const declared = [];                    // ui-forbidden `out.declared`
const observed = [];                    // ui-forbidden `out.observed`
const fringeOnNothing = { worst: 0, samples: 0 };   // edgeFringe() over zero edge pixels

const armB = [
  ['ui-metrics FD4', "out.captures.every((c) => c.clipped_elements.length === 0)",
    captures.every((c) => c.clipped_elements.length === 0)],
  ['ui-metrics FD6', "out.captures.every((c) => c.edge_fringe !== null && c.edge_fringe <= 40)  // edgeFringe() -> {worst: 0}",
    captures.every((c) => c.edge_fringe !== null && c.edge_fringe <= 40) && fringeOnNothing.worst <= 40],
  ['ui-metrics FD7', "out.captures.every((c) => (c.gradient_bits === null || c.gradient_bits >= 7) && c.overdraw <= 3)",
    captures.every((c) => (c.gradient_bits === null || c.gradient_bits >= 7) && c.overdraw <= 3)],
  ['ui-metrics FD3', "out.captures.every((c) => c.text_raster_scale === 1) && …",
    captures.every((c) => c.text_raster_scale === 1)],
  ['ui-forbidden U4', "out.declared.length === 0 ? 'PASS' : 'FAIL'",
    declared.length === 0],
  ['ui-forbidden U5', "(digit_hits === 0 && bar_hits === 0) ? 'PASS' : 'FAIL'  // two reduces over []",
    observed.reduce((a, o) => a + o.digit_glyphs, 0) === 0 && observed.reduce((a, o) => a + o.nameplate_bars, 0) === 0],
  ['ui-layer K2', "results.reduce((a, r) => a + r.undeclared.length, 0) === 0 ? 'PASS' : 'FAIL'",
    results.reduce((a, r) => a + r.undeclared.length, 0) === 0],
  ['ui-layer agree', "instrument.every((i) => i.differing_pixels === 0)",
    instrument.every((i) => i.differing_pixels === 0)],
  ['marker-diff K3', "out.differentials.every((d) => d.empty) ? 'PASS' : 'FAIL'",
    differentials.every((d) => d.empty)],
  ['marker-diff K4', "(out.yaw_sweep || []).every((s) => s.world_tracked.length === 0)  // and a bare catch { continue }",
    yawSweep.every((s) => s.world_tracked.length === 0)],
  ['ui-census U8', "Object.values(o.bar_contrasts).every((v) => v.fill_vs_trough >= 4.5)",
    Object.values(barContrasts).every((v) => v.fill_vs_trough >= 4.5)],
  ['ui-census U4b', "o.unknown_kinds.length === 0",
    unknownKinds.length === 0],
];

log('');
log('  ARM B — the ROUND-2 expressions, evaluated over the same empty sample sets:');
for (const [id, expr, value] of armB) {
  log(`    ${value ? 'PASS' : 'fail'}  ${id.padEnd(18)} ${expr}`);
}

// ---- the assertions ---------------------------------------------------------------------------
const checks = [];
const push = (id, pass, detail) => { checks.push({ id, pass, detail }); log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`); };

const totalChecks = armA.reduce((a, t) => a + t.checks.length, 0);
const anyGreen = armA.flatMap((t) => t.checks.filter((c) => c.status === 'PASS').map((c) => `${t.tool}:${c.id}`));
log('');
push('E1', totalChecks >= 15 && anyGreen.length === 0,
  `ARM A: ${totalChecks} graded checks across ${armA.length} detectors, all run with their subject removed. `
  + `Green on nothing: ${anyGreen.length ? anyGreen.join(', ') : 'NONE'}`);
push('E2', armA.every((t) => t.exit === 2),
  `every detector exits 2 (could not measure) rather than 0: [${armA.map((t) => `${t.tool}=${t.exit}`).join(' ')}]`);
push('E3', armA.every((t) => t.checks.length > 0 && t.checks.every((c) => c.status === 'EMPTY' || c.status === 'PARTIAL')),
  'every check reports EMPTY or PARTIAL — none reports PASS and none reports a FAIL it did not measure');
// THE CONTROL, WATCHED GOING RED. If arm B were also silent the two arms would be the same arm.
push('E4', armB.every(([, , v]) => v === true),
  `ARM B: ${armB.filter(([, , v]) => v).length} of ${armB.length} round-2 expressions return PASS over the same nothing. `
  + 'The arms differ, so the guard is what changed the answer.');

const out = {
  schema: 'elder-souls/w1-21-r3-empty@1',
  at: new Date().toISOString(),
  what: 'RULES 6 for the instrument: every graded check, with its subject removed',
  arm_a_fix_present: armA,
  arm_b_round2_expressions: armB.map(([id, expr, value]) => ({ id, expr, passes_on_nothing: value })),
  checks,
  ok: checks.every((c) => c.pass),
};
writeJson(path.join(RUN, 'empty-teardown.json'), out);

// The sample table the brief asks be published, assembled from the real runs' own tables.
const tables = [];
for (const [name, , outdir] of TOOLS) {
  const f = path.join(RUNS_DIR, outdir, 'sample-table.md');
  if (fs.existsSync(f)) tables.push(`### \`${name}\`\n\n${fs.readFileSync(f, 'utf8')}`);
}
if (tables.length) fs.writeFileSync(path.join(RUN, 'sample-table.md'), tables.join('\n\n'));

if (args.json) console.log(JSON.stringify(out, null, 2));
log(`empty-teardown: ${checks.filter((c) => c.pass).length}/${checks.length} — artifacts ${RUN}`);
process.exit(out.ok ? 0 : 1);
