#!/usr/bin/env node
// run-headless.mjs — boot the game in headless Chromium, run a named scenario,
// write artifacts to a run directory. The entry point every combat/world critic uses.
// Spec: corpus/80-methods/HARNESS.md
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, RUNS_DIR } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
import { loadScenario, listScenarios } from '../lib/scenario.mjs';
import { runScenario, newRunDir } from '../lib/run.mjs';

const USAGE = `
run-headless.mjs — run a scenario against the game in headless Chromium.

USAGE
  node tools/harness/run-headless.mjs --scenario <id> [options]

OPTIONS
  --scenario <id|path>  Scenario to run (default: smoke). Available: ${listScenarios().join(', ') || '(none)'}
  --entry <path>        HTML entry point (default: game/index.html)
  --url <url>           Load an already-served URL instead of starting a static server
  --seed <n>            Override the scenario seed
  --frames <n>          Override the scenario frame count
  --out <dir>           Run directory (default: reports/runs/<runId>)
  --width <n>           Viewport width (default 1920)
  --height <n>          Viewport height (default 1080)
  --timeout <ms>        Load / ready timeout (default 60000)
  --no-trace            Do not write trace.jsonl
  --chunk <n>           Frames per stepFrames() batch (default 300)
  --json                Print the manifest as JSON on stdout
  --help                This message

ARTIFACTS (written into the run directory)
  manifest.json  trace.jsonl  snapshot.json  world-stats.json  quest-state.json
  console.log    errors.json (only on failure)

NOTES
  Chromium is preinstalled at /opt/pw-browsers (PLAYWRIGHT_BROWSERS_PATH). Never run
  \`playwright install\`. If game/index.html does not exist yet this exits ${EXIT.MISSING_GAME};
  if it exists but does not expose window.__HARNESS it exits ${EXIT.HARNESS_ABSENT}.

SELF-TEST (no game required)
  node tools/harness/run-headless.mjs --scenario smoke --entry tools/harness/stub/index.html
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const scenario = loadScenario(args.scenario || 'smoke');
const seed = args.seed !== undefined ? Number(args.seed) : scenario.seed;
const frames = args.frames !== undefined ? Number(args.frames) : scenario.frames;
const runDir = newRunDir(scenario.id, seed, args.out);

log(`scenario=${scenario.id} seed=${seed} frames=${frames}`);
log(`run dir: ${path.relative(process.cwd(), runDir.dir) || runDir.dir}`);

const handle = await launchGame(args);
let manifest;
try {
  manifest = await runScenario(handle, scenario, {
    runDir, seed, frames,
    trace: args['no-trace'] !== true,
    chunk: Number(args.chunk || 300),
    onProgress: (a, b) => { if (a % 1200 === 0 || a === b) log(`  ${a}/${b} frames`); },
  });
} finally {
  await handle.close();
}

if (args.json) process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
else process.stdout.write(`${runDir.dir}\n`);
process.exit(manifest.ok ? EXIT.OK : EXIT.HARNESS_ERROR);
