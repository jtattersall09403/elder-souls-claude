#!/usr/bin/env node
// trace.mjs — drive scripted inputs and dump a JSONL per-frame trace.
// Thin, trace-focused front end over the same machinery as run-headless.mjs.
// Spec: corpus/80-methods/HARNESS.md §5.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, die, EXIT, readJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
import { loadScenario, listScenarios, normaliseInputs, normaliseScenario, scriptLastFrame } from '../lib/scenario.mjs';
import { runScenario, newRunDir } from '../lib/run.mjs';

const USAGE = `
trace.mjs — run scripted inputs and write a per-frame JSONL trace.

USAGE
  node tools/harness/trace.mjs --scenario <id> [--out <dir>]
  node tools/harness/trace.mjs --inputs <script.json> [--frames <n>] [--state <name>]

OPTIONS
  --scenario <id|path>  Named scenario (default: smoke). Available: ${listScenarios().join(', ') || '(none)'}
  --inputs <path>       Ad-hoc input script (JSON array) instead of a scenario
  --state <name>        loadState() argument when using --inputs (default: default)
  --spawn <id@x,z>      Repeatable: spawn an entity before the run (with --inputs)
  --seed <n>            Seed (default 1337 / scenario seed)
  --frames <n>          Frame count (default: scenario frames, or last input frame + 300)
  --entry <path>        HTML entry (default game/index.html)
  --url <url>           Load an already-served URL
  --out <dir>           Run directory (default reports/runs/<runId>)
  --stdout              Also stream the trace to stdout
  --help                This message

INPUT SCRIPT FORMAT (all sugar is normalised before it reaches the game)
  [{"f":0,"move":[0,1]}, {"f":90,"move":[0,0]}, {"f":100,"tap":"light"},
   {"f":200,"tap":"roll","hold":3}, {"f":300,"hold":["block"],"until":420}]
  Buttons: light heavy roll block parry sprint jump use_item interact lock_on
           two_hand swap_right swap_left menu

OUTPUT
  <run dir>/trace.jsonl — line 1 header, one record per simulated frame, final line footer
  with body_sha256. Two runs of the same scenario+seed MUST produce the same body_sha256.

SELF-TEST (no game required)
  node tools/harness/trace.mjs --scenario cmb-duel-infantry --entry tools/harness/stub/index.html
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

let scenario;
if (args.inputs) {
  const p = path.resolve(String(args.inputs));
  if (!fs.existsSync(p)) die(EXIT.USAGE, `input script not found: ${p}`);
  let raw;
  try { raw = readJson(p); } catch (e) { die(EXIT.USAGE, `input script is not valid JSON: ${e.message}`); }
  const list = Array.isArray(raw) ? raw : raw.inputs;
  if (!Array.isArray(list)) die(EXIT.USAGE, `input script must be a JSON array (or {"inputs":[...]})`);
  let inputs;
  try { inputs = normaliseInputs(list); } catch (e) { die(EXIT.USAGE, e.message); }
  const setup = [];
  for (const s of [].concat(args.spawn || [])) {
    const m = /^([\w.-]+)@(-?[\d.]+),(-?[\d.]+)$/.exec(String(s));
    if (!m) die(EXIT.USAGE, `--spawn must look like id@x,z (got ${s})`);
    setup.push({ op: 'spawn', id: m[1], x: Number(m[2]), z: Number(m[3]), as: `e${setup.length}` });
  }
  scenario = normaliseScenario({
    id: path.basename(p, '.json'), title: `ad-hoc script ${p}`,
    seed: args.seed !== undefined ? Number(args.seed) : 1337,
    state: args.state ? String(args.state) : 'default',
    frames: args.frames !== undefined ? Number(args.frames) : scriptLastFrame(inputs) + 300,
    setup, inputs: list, world: {},
  });
} else {
  scenario = loadScenario(args.scenario || 'smoke');
}

const seed = args.seed !== undefined ? Number(args.seed) : scenario.seed;
const frames = args.frames !== undefined ? Number(args.frames) : scenario.frames;
const runDir = newRunDir(scenario.id, seed, args.out);

log(`tracing scenario=${scenario.id} seed=${seed} frames=${frames} inputs=${scenario.inputs.length}`);
const handle = await launchGame(args);
let manifest;
try {
  manifest = await runScenario(handle, scenario, { runDir, seed, frames, trace: true });
} finally {
  await handle.close();
}

const tracePath = path.join(runDir.dir, 'trace.jsonl');
if (args.stdout) process.stdout.write(fs.readFileSync(tracePath, 'utf8'));
else process.stdout.write(tracePath + '\n');
log(`body_sha256=${manifest.trace.body_sha256}`);
process.exit(manifest.ok ? EXIT.OK : EXIT.HARNESS_ERROR);
