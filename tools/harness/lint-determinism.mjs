#!/usr/bin/env node
// lint-determinism.mjs — the static half of HARNESS.md §8.
//
// RI-MTH02 M8 is explicit that a static grep is **advisory**: the trace hashes are the
// verdict. This tool exists anyway, for two reasons:
//   1. it gives a builder somewhere to start when a hash diverges;
//   2. it turns "no Math.random in the sim" from a convention into a check that can fail a
//      commit, which is what the brief asks for.
//
// The runtime counterpart — the guard in game/src/core/guards.js — is the one that bites:
// it throws if any of these is called inside a fixed step. This one cannot see through a
// dynamic dispatch and does not pretend to.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, GAME_DIR, writeJson, REPORTS_DIR } from '../lib/cli.mjs';

const USAGE = `
lint-determinism.mjs — static scan of the shipped game sources for banned constructs.

USAGE
  node tools/harness/lint-determinism.mjs [--root game/src] [--json]

OPTIONS
  --root <dir>   Directory to scan (default game/src)
  --json         Print the full report
  --help         This message

BANNED IN THE SIMULATION PATH (HARNESS.md §8 D1-D4)
  Math.random   Date.now   performance.now   new Date   deltaTime   elapsedTime
  THREE.Clock   getDelta   getElapsedTime

The scan is scoped: files under sim/ and core/rng.js are SIMULATION and any hit is an error.
Files under render/, save/, harness/ and core/guards.js|loop.js are NON-SIMULATION, where
wall clock and cosmetic randomness are legal (HARNESS.md §8, final paragraph) and hits are
reported as informational.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const root = args.root ? path.resolve(String(args.root)) : path.join(GAME_DIR, 'src');
const PATTERNS = [
  { re: /\bMath\.random\s*\(/g, id: 'Math.random', rule: 'D1/D2' },
  { re: /\bDate\.now\s*\(/g, id: 'Date.now', rule: 'D3' },
  { re: /\bperformance\.now\s*\(/g, id: 'performance.now', rule: 'D3' },
  { re: /\bnew\s+Date\s*\(/g, id: 'new Date', rule: 'D3' },
  { re: /\bdeltaTime\b/g, id: 'deltaTime', rule: 'D4' },
  { re: /\belapsedTime\b/g, id: 'elapsedTime', rule: 'D4' },
  { re: /\bTHREE\.Clock\b|\bnew\s+Clock\s*\(/g, id: 'THREE.Clock', rule: 'D3/D4' },
  { re: /\.getDelta\s*\(|\.getElapsedTime\s*\(/g, id: 'Clock.getDelta', rule: 'D3/D4' },
];

/** Files whose contents ARE the simulation. A hit here is an error, not a lead. */
const SIM_PATHS = [/[\\/]sim[\\/]/, /[\\/]core[\\/]rng\.js$/, /[\\/]core[\\/]canonical\.js$/, /[\\/]input[\\/]pipeline\.js$/, /[\\/]input[\\/]actions\.js$/];
/** Files that are allowed to touch the wall clock because they cannot reach a traced value. */
const ALLOWED = [/[\\/]core[\\/]guards\.js$/, /[\\/]core[\\/]loop\.js$/, /[\\/]vendor[\\/]/];

const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|mjs)$/.test(e.name)) files.push(p);
  }
};
walk(root);

const errors = [], info = [];
for (const f of files) {
  if (ALLOWED.some((r) => r.test(f))) continue;
  const isSim = SIM_PATHS.some((r) => r.test(f));
  const text = fs.readFileSync(f, 'utf8');
  const lines = text.split('\n');
  for (const { re, id, rule } of PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const codeOnly = line.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '');
      re.lastIndex = 0;
      if (!re.test(codeOnly)) continue;
      const hit = { file: path.relative(process.cwd(), f), line: i + 1, construct: id, rule, text: line.trim().slice(0, 140) };
      (isSim ? errors : info).push(hit);
    }
  }
}

const report = {
  schema: 'elder-souls/determinism-lint@1',
  root: path.relative(process.cwd(), root),
  files_scanned: files.length,
  errors,
  informational: info,
  note: 'Advisory per RI-MTH02 M8. The verdict is the trace hash; the enforcement is the runtime guard in game/src/core/guards.js.',
};
writeJson(path.join(REPORTS_DIR, 'determinism-lint.json'), report);

for (const e of errors) log(`ERROR ${e.file}:${e.line} ${e.construct} (${e.rule}) — ${e.text}`);
for (const e of info) log(`info  ${e.file}:${e.line} ${e.construct} (non-simulation path)`);
log(`${files.length} files scanned: ${errors.length} error(s), ${info.length} informational`);
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
process.exit(errors.length ? EXIT.MEASUREMENT_FAIL : EXIT.OK);
