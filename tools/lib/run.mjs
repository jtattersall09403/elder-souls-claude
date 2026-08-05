// Scenario execution + artifact writing. Shared by run-headless.mjs and trace.mjs.
// Spec: corpus/80-methods/HARNESS.md §5 (trace format), §6 (run directory).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  RUNS_DIR, TRACE_SCHEMA, EXIT, die, log, ensureDir, writeJson,
  gitInfo, hashDataTree, makeRunId,
} from './cli.mjs';
import { requireMethods } from './browser.mjs';

export const REQUIRED_METHODS = [
  'setSeed', 'stepFrames', 'queueInputs', 'snapshot', 'traceStart', 'traceStop',
];
export const SETUP_OPS = {
  teleport: (h, o) => h.h('teleport', o.x, o.z, o.opts || {}),
  spawn: (h, o) => h.h('spawn', o.id, o.x, o.z, { as: o.as }),
  despawn: (h, o) => h.h('despawn', o.eid || o.as),
  aggro: (h, o) => h.hOpt('aggro', o.target || o.eid || o.as),
  lockOn: (h, o) => h.hOpt('lockOn', o.target || o.eid || o.as),
  loadState: (h, o) => h.h('loadState', o.state),
  setTimeOfDay: (h, o) => h.hOpt('setTimeOfDay', o.hour ?? o.value),
  setWeather: (h, o) => h.hOpt('setWeather', o.weather ?? o.value),
  camera: (h, o) => h.hOpt('camera', o.pose || o),
};

export function newRunDir(scenarioId, seed, outArg) {
  const runId = makeRunId(scenarioId, seed);
  const dir = outArg ? path.resolve(String(outArg)) : path.join(RUNS_DIR, runId);
  ensureDir(dir);
  return { runId, dir };
}

/** Header record written as line 1 of every trace. Makes a trace self-identifying. */
export function traceHeader({ runId, scenario, seed, handle, extra }) {
  return {
    _: 'header',
    schema: TRACE_SCHEMA,
    run_id: runId,
    scenario: scenario.id,
    scenario_title: scenario.title || null,
    scenario_path: scenario.__path || null,
    seed,
    fixed_step_hz: 60,
    started_at: new Date().toISOString(),
    tool: 'elder-souls/tools',
    node: process.version,
    url: handle ? handle.url : null,
    harness_version: handle ? handle.harnessVersion : null,
    build: handle ? handle.buildInfo : null,
    git: gitInfo(),
    data: hashDataTree(),
    ...(extra || {}),
  };
}

/**
 * Run a scenario end to end against a live handle, streaming the trace to disk.
 * @returns {Promise<object>} manifest
 */
export async function runScenario(handle, scenario, opts = {}) {
  const { runId, dir } = opts.runDir || newRunDir(scenario.id, scenario.seed, opts.out);
  const seed = Number.isFinite(opts.seed) ? opts.seed : scenario.seed;
  const frames = Number.isFinite(opts.frames) ? opts.frames : scenario.frames;
  const chunk = Number(opts.chunk || 300);
  const wantTrace = opts.trace !== false;

  await requireMethods(handle, REQUIRED_METHODS);

  const t0 = Date.now();
  // 1. determinism: seed BEFORE any world load.
  await handle.h('setSeed', seed);
  if (scenario.state) await handle.hOpt('loadState', scenario.state);
  else await handle.hOpt('reset', { seed });

  // 2. deterministic environment.
  if (scenario.world.timeOfDay !== undefined) await handle.hOpt('setTimeOfDay', scenario.world.timeOfDay);
  if (scenario.world.weather !== undefined) await handle.hOpt('setWeather', scenario.world.weather);

  // 3. scenario setup ops.
  for (const op of scenario.setup) {
    const fn = SETUP_OPS[op.op];
    if (!fn) die(EXIT.USAGE, `unknown setup op '${op.op}' in scenario ${scenario.id}. Known: ${Object.keys(SETUP_OPS).join(', ')}`);
    await fn(handle, op);
  }

  // 4. warmup (settle physics/anim) — traced separately so it can be excluded.
  if (scenario.warmupFrames > 0) await handle.h('stepFrames', scenario.warmupFrames);

  // 5. inputs + trace.
  await handle.h('queueInputs', scenario.inputs);
  const tracePath = path.join(dir, 'trace.jsonl');
  let out = null, bodyHash = null, records = 0;
  if (wantTrace) {
    out = fs.createWriteStream(tracePath);
    bodyHash = crypto.createHash('sha256');
    out.write(JSON.stringify(traceHeader({ runId, scenario, seed, handle })) + '\n');
    await handle.h('traceStart', scenario.trace);
  }

  const canDrain = await handle.page.evaluate(() => typeof window.__HARNESS.traceDrain === 'function');
  let stepped = 0;
  while (stepped < frames) {
    const n = Math.min(chunk, frames - stepped);
    await handle.h('stepFrames', n);
    stepped += n;
    if (wantTrace && canDrain) {
      const recs = await handle.h('traceDrain');
      for (const r of recs) { const line = JSON.stringify(r) + '\n'; bodyHash.update(line); out.write(line); records++; }
    }
    if (opts.onProgress) opts.onProgress(stepped, frames);
  }

  if (wantTrace) {
    const tail = await handle.h('traceStop');
    if (Array.isArray(tail)) {
      for (const r of tail) { const line = JSON.stringify(r) + '\n'; bodyHash.update(line); out.write(line); records++; }
    }
    const digest = bodyHash.digest('hex');
    out.write(JSON.stringify({ _: 'footer', frames: records, body_sha256: digest, ended_at: new Date().toISOString() }) + '\n');
    await new Promise((r) => out.end(r));
    if (records === 0) {
      die(EXIT.MEASUREMENT_FAIL,
        'trace is empty: the harness emitted 0 per-frame records. ' +
        'traceStart()/traceDrain()/traceStop() must return one record per simulated frame ' +
        '(HARNESS.md §5). A critic cannot score anything from this.');
    }
    var traceDigest = digest;
  }

  const snapshot = await handle.h('snapshot');
  const worldStats = await handle.hOpt('getWorldStats');
  const questState = await handle.hOpt('getQuestState');

  const manifest = {
    schema: 'elder-souls/run-manifest@1',
    run_id: runId,
    ok: handle.errors.length === 0,
    scenario: scenario.id,
    scenario_title: scenario.title || null,
    seed,
    frames_requested: frames,
    frames_traced: records,
    warmup_frames: scenario.warmupFrames,
    fixed_step_hz: 60,
    trace: wantTrace ? { path: path.relative(dir, tracePath), records, body_sha256: traceDigest } : null,
    url: handle.url,
    harness_version: handle.harnessVersion,
    build: handle.buildInfo,
    git: gitInfo(),
    data: hashDataTree(),
    started_at: new Date(t0).toISOString(),
    ended_at: new Date().toISOString(),
    wall_ms: Date.now() - t0,
    page_errors: handle.errors,
    console_errors: handle.console.filter((c) => c.type === 'error').slice(0, 50),
    node: process.version,
    tool_argv: process.argv.slice(1),
  };
  writeJson(path.join(dir, 'manifest.json'), manifest);
  writeJson(path.join(dir, 'snapshot.json'), snapshot);
  if (worldStats) writeJson(path.join(dir, 'world-stats.json'), worldStats);
  if (questState) writeJson(path.join(dir, 'quest-state.json'), questState);
  fs.writeFileSync(path.join(dir, 'console.log'),
    handle.console.map((c) => `[${c.type}] ${c.text}`).join('\n') + '\n');
  if (handle.errors.length) writeJson(path.join(dir, 'errors.json'), handle.errors);

  log(`run ${runId}: ${records} frames traced -> ${dir}`);
  return manifest;
}
