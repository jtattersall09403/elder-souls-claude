#!/usr/bin/env node
// run-all.mjs — run every measurement that is currently possible and write a
// machine-readable report to reports/. Skips (loudly) what does not exist yet.
// Spec: corpus/80-methods/HARNESS.md §9.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  parseArgs, wantsHelp, usage, log, EXIT, TOOLS_DIR, REPO_ROOT, GAME_DIR, DATA_DIR,
  REPORTS_DIR, RUNS_DIR, ensureDir, writeJson, utcStamp, gitInfo, hashDataTree,
} from './lib/cli.mjs';
import { listScenarios } from './lib/scenario.mjs';

const USAGE = `
run-all.mjs — run the whole measurement harness and write a report.

USAGE
  node tools/run-all.mjs [--stub] [--scenarios a,b] [--out <file>]

OPTIONS
  --stub             Measure the harness stub fixture instead of the real game
                     (tools/harness/stub/index.html) — used to verify the tooling itself
  --entry <path>     Explicit HTML entry point
  --scenarios <ids>  Comma-separated scenario ids (default: all)
  --skip <steps>     Comma-separated step names to skip
  --out <path>       Report path (default: reports/run-all-<utc>.json, plus reports/latest.json)
  --quick            smoke + content-stats only
  --help             This message

STEPS
  env-smoke       tools/harness/smoke.mjs           (never skipped — proves the browser works)
  content-stats   tools/analysis/content-stats.mjs  (needs game/data)
  scenario:<id>   tools/harness/run-headless.mjs    (needs game/index.html + window.__HARNESS)
  trace-stats:<id>tools/harness/trace-stats.mjs
  shots           tools/harness/shoot.mjs
  image-metrics   tools/metrics/image-metrics.mjs

Every step records: status (ok|skipped|failed), exit code, duration, artifact paths and the
first 2000 characters of stderr. A skipped step is a corpus hole, not a pass.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const skip = new Set(String(args.skip || '').split(',').map((s) => s.trim()).filter(Boolean));
const useStub = args.stub === true;
const entry = args.entry ? String(args.entry) : (useStub ? path.join(TOOLS_DIR, 'harness', 'stub', 'index.html') : null);
const stamp = utcStamp();
const reportDir = path.join(RUNS_DIR, `all-${stamp}`);
ensureDir(reportDir);

const steps = [];
function run(name, script, argv, { needs = [], produces = null } = {}) {
  if (skip.has(name)) { steps.push({ name, status: 'skipped', reason: '--skip' }); log(`SKIP ${name}`); return null; }
  for (const n of needs) {
    if (!fs.existsSync(n)) {
      steps.push({ name, status: 'skipped', reason: `missing prerequisite: ${path.relative(REPO_ROOT, n)}`, script });
      log(`SKIP ${name} — missing ${path.relative(REPO_ROOT, n)}`);
      return null;
    }
  }
  const t0 = Date.now();
  log(`RUN  ${name}: node ${path.relative(REPO_ROOT, script)} ${argv.join(' ')}`);
  const r = spawnSync(process.execPath, [script, ...argv], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const ok = r.status === 0;
  const stdout = (r.stdout || '').trim();
  steps.push({
    name, script: path.relative(REPO_ROOT, script), argv,
    status: ok ? 'ok' : 'failed', exit_code: r.status,
    ms: Date.now() - t0,
    stdout_tail: stdout.split('\n').slice(-3).join('\n'),
    stderr_head: (r.stderr || '').slice(0, 2000),
    artifact: produces || (stdout && fs.existsSync(stdout.split('\n').pop()) ? stdout.split('\n').pop() : null),
  });
  log(`${ok ? 'OK  ' : 'FAIL'} ${name} (${Date.now() - t0}ms, exit ${r.status})`);
  return ok ? stdout.split('\n').pop() : null;
}

const S = (...p) => path.join(TOOLS_DIR, ...p);
const entryArgs = entry ? ['--entry', entry] : [];

// 1. environment
run('env-smoke', S('harness', 'smoke.mjs'), ['--out', path.join(reportDir, 'harness-smoke.json')]);

// 2. static content analysis — no browser needed
run('content-stats', S('analysis', 'content-stats.mjs'),
  ['--data', DATA_DIR, '--out', path.join(reportDir, 'content-stats.json')],
  { needs: [DATA_DIR] });

if (!args.quick) {
  const gameEntry = entry || path.join(GAME_DIR, 'index.html');
  const scenarios = args.scenarios ? String(args.scenarios).split(',').map((s) => s.trim()) : listScenarios();

  // 3. scenarios + trace stats
  for (const sc of scenarios) {
    const runDir = path.join(reportDir, 'scenario-' + sc);
    const out = run('scenario:' + sc, S('harness', 'run-headless.mjs'),
      ['--scenario', sc, '--out', runDir, ...entryArgs],
      { needs: [gameEntry], produces: runDir });
    if (out) {
      run('trace-stats:' + sc, S('harness', 'trace-stats.mjs'),
        ['--in', path.join(runDir, 'trace.jsonl'), '--out', path.join(runDir, 'trace-stats.json')],
        { needs: [path.join(runDir, 'trace.jsonl')], produces: path.join(runDir, 'trace-stats.json') });
    }
  }

  // 4. screenshots + image metrics
  const shotsDir = path.join(reportDir, 'shots');
  const shots = run('shots', S('harness', 'shoot.mjs'), ['--out', shotsDir, ...entryArgs],
    { needs: [gameEntry], produces: shotsDir });
  if (shots) {
    run('image-metrics', S('metrics', 'image-metrics.mjs'),
      ['--in', shotsDir, '--out', path.join(reportDir, 'image-metrics.json')],
      { needs: [shotsDir], produces: path.join(reportDir, 'image-metrics.json') });
  }
}

const report = {
  schema: 'elder-souls/run-all@1',
  run_id: 'all-' + stamp,
  at: new Date().toISOString(),
  mode: useStub ? 'stub-selftest' : 'game',
  entry: entry || path.join(GAME_DIR, 'index.html'),
  game_present: fs.existsSync(entry || path.join(GAME_DIR, 'index.html')),
  data_present: fs.existsSync(DATA_DIR),
  report_dir: reportDir,
  node: process.version,
  git: gitInfo(),
  data: hashDataTree(),
  summary: {
    total: steps.length,
    ok: steps.filter((s) => s.status === 'ok').length,
    failed: steps.filter((s) => s.status === 'failed').length,
    skipped: steps.filter((s) => s.status === 'skipped').length,
  },
  corpus_holes: steps.filter((s) => s.status === 'skipped' && s.reason && s.reason.startsWith('missing'))
    .map((s) => ({ step: s.name, reason: s.reason })),
  steps,
};

const outPath = args.out ? path.resolve(String(args.out)) : path.join(REPORTS_DIR, `run-all-${stamp}.json`);
writeJson(outPath, report);
writeJson(path.join(REPORTS_DIR, 'latest.json'), report);
log(`summary: ${report.summary.ok} ok, ${report.summary.failed} failed, ${report.summary.skipped} skipped`);
process.stdout.write(outPath + '\n');
process.exit(report.summary.failed ? EXIT.MEASUREMENT_FAIL : EXIT.OK);
