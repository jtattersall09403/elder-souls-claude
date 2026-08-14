#!/usr/bin/env node
/**
 * gpu-deck.mjs — run the Deck (and the motion sequences) on a real GPU, in one batched job.
 *
 * THE JOIN. Two things in this repo both work and had never been connected. The RunPod transport
 * is proven — `reports/runpod-gpu/TRANSPORT-20260814.md`, two live runs, RTX A4500 and A5000, the
 * game rendering under `ANGLE (NVIDIA, Vulkan 1.4.312)` rather than SwiftShader, artefacts back
 * as one tar over ordinary HTTPS. The visual capture tools are proven too, and every frame they
 * have ever taken has been SwiftShader. This tool points one at the other.
 *
 * WHY ONE BATCHED JOB AND NOT A ROUND TRIP PER FRAME. A Pod bills by the minute and the RunPod
 * proxy takes 40–90 s before it routes at all; a run budget under about four minutes does not
 * survive its own provisioning (HAZARDS §4). So the Pod is sent ONE command that captures
 * everything and returns ONE tar. Everything else — per-frame round trips especially — pays the
 * provisioning cost again and again for nothing.
 *
 * WHAT IT COSTS. `--estimate` prints the model with no spend at all, and every real run prints
 * the actual dollars and minutes at the end and records them in the run report. The model's
 * constants are measured, and where they are not yet measured this file says so out loud.
 *
 * THE DEFAULT IS STILL LOCAL. This tool is the only thing that rents a GPU; `deck.mjs` and
 * `deck-motion.mjs` run on this box on SwiftShader unless asked otherwise. Hardware is an
 * option, because it costs money and because cheap local iteration is how builders work.
 *
 * Usage:
 *   node tools/visual/gpu-deck.mjs --estimate --profile full        # spends nothing
 *   node tools/visual/gpu-deck.mjs --profile smoke --tag hw-smoke   # rents a Pod
 *   node tools/visual/gpu-deck.mjs --profile full  --tag hw-full --max-runtime 60
 *   node tools/visual/gpu-deck.mjs --self-test                      # no browser-free arms, no spend
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2);
  args[k] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
}

/**
 * The cost model. Every number here is either measured on live hardware or marked as an
 * estimate; a model that cannot tell you which is which is a guess with a table around it.
 */
export const COST_MODEL = {
  // EVERY NUMBER HERE IS MEASURED, on two live runs on 2026-08-14 — the proving run in
  // reports/runpod-gpu/runs/deck-hw-smoke/ (Pod ji4npp76y25f51, RTX A4500, $0.25/hr,
  // 11:03:38Z → 11:06:57Z, 3.34 min wall, $0.014 spent) and the full Deck in
  // reports/runpod-gpu/runs/deck-hw-full/ (RTX A5000, $0.27/hr). The smoke run's timeline:
  //
  //   11:03:38  run starts, Pod created two seconds later
  //   11:04:38  Pod agent answers through the RunPod proxy       → 60 s provision + route
  //   11:05:40  bootstrap done (apt, Node 22, Playwright, Xvfb)  → 62 s bootstrap
  //   11:05:53  game ready, renderer attested HARDWARE           → 13 s backend probe + boot
  //   11:06:08  6 stills captured                                → 15.3 s / 6 = 2.55 s per still
  //   11:06:49  180 motion frames captured in 27.7 s             → 0.154 s per motion frame
  //   11:06:57  artefacts retrieved, Pod terminated, confirmed   → ~20 s teardown
  //
  // The earlier transport runs saw the proxy take up to 90 s to route, so the provisioning
  // figure is kept at the slower end deliberately: an estimate that is optimistic about
  // provisioning is the one that gets a run killed by its own watchdog.
  provision_and_route_sec: 90,
  bootstrap_sec: 65,
  game_boot_sec: 15,              // backend probe + Playwright launch + the game's own ready()
  teardown_sec: 25,               // delete + deletion-confirmed polling + artefact retrieval
  // Stills cost two different things, and one run could not tell them apart. Two can:
  //   smoke (A4500):  6 setups,  6 stills → 15.3 s   ⇒ S +  F = 2.55
  //   full  (A5000): 48 setups, 288 stills → 143.1 s ⇒ S + 6F = 2.98
  // Solving: a SETUP (teleport, exit an interior, settle, pose) costs 2.46 s, and each further
  // still off the same setup costs 0.086 s. That is why the full Deck is not 48× the smoke: the
  // 6 lights per setup are nearly free once you are standing there.
  setup_sec: 2.46,
  still_sec: 0.086,
  motion_frame_sec: 0.154,
  png_bytes: 880_000,             // measured: 37 PNGs at 960x540 came home as 31.5 MiB
  usd_per_hour: 0.27,             // measured: RTX A5000 $0.27/hr; the A4500 was $0.25/hr
  measured_from: 'reports/runpod-gpu/runs/deck-hw-smoke/ (RTX A4500) and deck-hw-full/ (RTX A5000), both live on 2026-08-14; every constant is fitted to those two runs, not estimated',
};

export function planFor(deck, profileName, { frameCap = null, every = 1, withMotion = true, withStills = true } = {}) {
  const profile = deck.profiles[profileName];
  if (!profile) throw new Error(`unknown profile '${profileName}'. have: ${Object.keys(deck.profiles).join(', ')}`);
  const setups = withStills ? profile.stills.length : 0;
  const stills = withStills ? profile.stills.length * profile.times.length * profile.weathers.length : 0;
  const sequences = withMotion ? (profile.motion || []) : [];
  const motionFrames = sequences.reduce((total, id) => {
    const sequence = deck.motion.find((m) => m.id === id);
    if (!sequence) return total;
    return total + Math.ceil((frameCap || sequence.frames) / every);
  }, 0);
  return { profile: profileName, setups, stills, sequences: sequences.length, motionFrames };
}

/**
 * How many megabytes come home. This is a real constraint, not trivia: the controller buffers the
 * whole tar in memory (`downloadDirectory` in tools/runpod/lib/http-transport.mjs), so a full
 * motion capture returned frame-for-frame is ~2 GB in one HTTP response. `--return` decides.
 */
export function returnBytes(plan, returnLevel, sheetEvery = 6, model = COST_MODEL) {
  const motionKept = returnLevel === 'all' ? plan.motionFrames
    : returnLevel === 'sheets' ? 0
      : Math.ceil(plan.motionFrames / sheetEvery);
  return (plan.stills + motionKept) * model.png_bytes;
}

export function estimate(plan, model = COST_MODEL) {
  const captureSec = plan.setups * model.setup_sec + plan.stills * model.still_sec + plan.motionFrames * model.motion_frame_sec;
  // Two browser launches: one for the stills, one for the sequences.
  const browserSec = (plan.stills ? model.game_boot_sec : 0) + (plan.motionFrames ? model.game_boot_sec : 0);
  const overheadSec = model.provision_and_route_sec + model.bootstrap_sec + model.teardown_sec + browserSec;
  const totalSec = overheadSec + captureSec;
  return {
    ...plan,
    capture_sec: Math.round(captureSec),
    overhead_sec: Math.round(overheadSec),
    total_sec: Math.round(totalSec),
    total_min: +(totalSec / 60).toFixed(1),
    usd: +((totalSec / 3600) * model.usd_per_hour).toFixed(3),
    usd_per_hour: model.usd_per_hour,
    // The Pod is billed for the whole lifecycle, so the runtime cap must clear the estimate with
    // room: a run killed by its own watchdog pays for the Pod and returns nothing.
    suggested_max_runtime_min: Math.max(10, Math.ceil((totalSec * 1.5) / 60)),
    basis: model.measured_from,
  };
}

function printEstimate(e, returnLevel = 'sample', sheetEvery = 6) {
  const mb = returnBytes(e, returnLevel, sheetEvery) / 1048576;
  console.log(`plan:      profile=${e.profile}  ${e.stills} stills + ${e.sequences} motion sequence(s) = ${e.motionFrames} motion frames`);
  console.log(`capture:   ${(e.capture_sec / 60).toFixed(1)} min of rendering`);
  console.log(`overhead:  ${(e.overhead_sec / 60).toFixed(1)} min (provision+proxy ${COST_MODEL.provision_and_route_sec}s, bootstrap ${COST_MODEL.bootstrap_sec}s, boots, teardown)`);
  console.log(`TOTAL:     ${e.total_min} min at $${e.usd_per_hour}/hr = $${e.usd}`);
  console.log(`suggested: --max-runtime ${e.suggested_max_runtime_min}`);
  console.log(`returns:   ~${mb.toFixed(0)} MB in one tar (--return ${returnLevel}); the controller buffers it whole, so keep this under ~500 MB`);
  console.log(`basis:     ${e.basis}`);
}

/** The single shell command the Pod runs. One job, one tar back. */
export function remoteCommand({ profile, tag, frameCap, every, withStills, withMotion, returnLevel, sheetEvery = 6 }) {
  const lines = [
    'set -euo pipefail',
    'ART="$RUNPOD_ARTIFACT_DIR"',
    `TAG=${JSON.stringify(tag)}`,
    'mkdir -p "$ART"',
  ];
  if (withStills) {
    lines.push(`node tools/visual/deck.mjs --profile ${profile} --tag "$TAG" --gpu hardware --require-hardware --out "$ART/deck/$TAG" 2>&1 | tee -a "$ART/deck.log"`);
  }
  if (withMotion) {
    const capFlag = frameCap ? ` --frames ${Number(frameCap)}` : '';
    lines.push(`node tools/visual/deck-motion.mjs --profile ${profile} --tag "$TAG" --gpu hardware --require-hardware --every ${Number(every) || 1}${capFlag} --sheet-every ${Number(sheetEvery)} --out "$ART/motion/$TAG" 2>&1 | tee -a "$ART/motion.log"`);
    // Bound what comes home. The controller buffers the whole tar in memory, and a full motion
    // capture is thousands of PNGs; the contact sheets are the review artefact for a sequence
    // (W1-30-EVIDENCE §1), and §5 says raw PNG sequences are not committed anyway.
    if (returnLevel === 'sheets') {
      lines.push(`rm -rf "$ART/motion/$TAG/frames"`);
    } else if (returnLevel !== 'all') {
      lines.push(`find "$ART/motion/$TAG/frames" -name '*.png' | sort | awk 'NR % ${Number(sheetEvery)} != 1' | xargs -r rm -f`);
    }
  }
  lines.push('du -sh "$ART" | tee "$ART/return-size.txt"');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// --self-test
// ---------------------------------------------------------------------------------------------
// HAZARDS §0's fifth failure shape: a suite where every arm fabricates the disputed input
// identically can never falsify its shared premise. Here the disputed input is THE RENDERER
// STRING, so the two arms that matter do not invent one:
//
//   * the software arm launches a real browser on this box and reads the string off the page;
//   * the hardware arm reads the string out of docs/shots/2026-08-14-gpu-transport/gpu-smoke.json,
//     which was written by an RTX A5000 on a live Pod and committed as evidence.
//
// Neither string is typed by this file, and an arm asserts they differ — so if some future edit
// made both arms read the same source, the suite goes red instead of passing vacuously.
async function selfTest({ json = false } = {}) {
  const { classifyRenderer, manifestRendererFields } = await import('./lib/renderer-class.mjs');
  const results = [];
  const arm = async (name, fn) => {
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail: detail || null });
    } catch (error) {
      results.push({ name, ok: false, detail: String(error && error.message || error).split('\n')[0].slice(0, 400) });
    }
  };
  const must = (condition, message) => { if (!condition) throw new Error(message); };

  // --- the two arms that supply a renderer string they did not invent -------------------------
  const RECORDED_HARDWARE_EVIDENCE = 'docs/shots/2026-08-14-gpu-transport/gpu-smoke.json';
  let recordedHardwareString = null;
  let liveSoftwareString = null;

  await arm('hardware/recorded-live-pod-renderer-string-is-detected-as-hardware', async () => {
    const file = path.join(REPO, RECORDED_HARDWARE_EVIDENCE);
    must(fs.existsSync(file), `${RECORDED_HARDWARE_EVIDENCE} is missing: the hardware arm has no un-fabricated input and cannot run`);
    const report = JSON.parse(fs.readFileSync(file, 'utf8'));
    recordedHardwareString = report?.game?.renderer?.renderer || report?.webgl?.renderer || null;
    must(typeof recordedHardwareString === 'string' && recordedHardwareString.length > 10,
      `${RECORDED_HARDWARE_EVIDENCE} carries no renderer string`);
    const verdict = classifyRenderer(recordedHardwareString, { hardwareRequested: true });
    must(verdict.hardware === true, `a string produced by a real RTX A5000 classified ${verdict.class}: ${verdict.reason}`);
    must(verdict.evidence_class.startsWith('HARDWARE'), 'evidence_class did not say HARDWARE');
    return `${recordedHardwareString.slice(0, 80)}… → HARDWARE (from ${RECORDED_HARDWARE_EVIDENCE}, written by a Pod, not by this test)`;
  });

  await arm('software/live-browser-on-this-box-is-detected-as-software', async () => {
    // In a CHILD process, because tools/lib/browser.mjs fails by calling die() -> process.exit:
    // a missing Playwright or a full disk would otherwise end the whole suite rather than redden
    // this one arm. Same lesson as the deck's call(): what cannot be caught must be contained.
    const probe = spawnSync(process.execPath, [path.join(REPO, 'tools/visual/test/probe-local-renderer.mjs')], {
      encoding: 'utf8', cwd: REPO, timeout: 180_000,
    });
    const line = String(probe.stdout || '').trim().split('\n').filter((l) => l.startsWith('{')).pop();
    must(line, `the local browser probe produced no result (exit ${probe.status}): ${String(probe.stderr || '').split('\n').slice(-3).join(' ').slice(0, 300)}`);
    const result = JSON.parse(line);
    must(result.ok, `the local browser probe failed: ${result.error}`);
    liveSoftwareString = result.renderer_string;
    const verdict = classifyRenderer(liveSoftwareString, { hardwareRequested: false });
    must(verdict.software_renderer === true, `a live local browser classified ${verdict.class}: ${verdict.renderer_string}`);
    must(verdict.evidence_class.startsWith('SOFTWARE'), 'evidence_class did not say SOFTWARE');
    return `${String(liveSoftwareString).slice(0, 80)}… → SOFTWARE (read off a live page, not typed here)`;
  });

  await arm('premise/the-two-arms-do-not-share-an-input', async () => {
    must(recordedHardwareString && liveSoftwareString, 'one of the two un-fabricated arms did not produce a string, so this check cannot run');
    must(recordedHardwareString !== liveSoftwareString,
      'the hardware and software arms read the SAME renderer string — the suite would agree with itself about the one input it is supposed to dispute');
    return `hardware "${recordedHardwareString.slice(0, 40)}…" vs software "${String(liveSoftwareString).slice(0, 40)}…"`;
  });

  // --- the red control: the detector must go red when fed the wrong string --------------------
  await arm('red-control/feeding-the-wrong-string-inverts-the-verdict', async () => {
    must(recordedHardwareString && liveSoftwareString, 'both real strings are needed for the swap');
    const swappedHardware = classifyRenderer(liveSoftwareString, { hardwareRequested: true });
    const swappedSoftware = classifyRenderer(recordedHardwareString, { hardwareRequested: false });
    // If the classifier were reading the REQUEST instead of the string, both of these would keep
    // the requested class and this arm would pass wrongly. It must flip both ways.
    must(swappedHardware.hardware === false,
      'the software string classified HARDWARE when hardware was requested: the detector is reading the request, not the renderer');
    must(swappedSoftware.hardware === true,
      'the hardware string classified SOFTWARE when software was requested: the detector is reading the request, not the renderer');
    return 'swapping the inputs swaps the verdicts, so the verdict follows the string';
  });

  // --- the exact historical defect ------------------------------------------------------------
  await arm('fail-open/the-2026-08-14-defect-string-is-software', async () => {
    // The probe used to throw and the catch returned a message matching no software pattern, so
    // the manifest recorded software_renderer:false ON SWIFTSHADER. Any string like this must be
    // software now, by the "names no GPU vendor" rule.
    for (const string of [
      "unavailable: Cannot read properties of undefined (reading 'getContext')",
      'unavailable: no webgl2 context',
      '',
      'undefined',
      'WebGL 2.0 (OpenGL ES 3.0 Chromium)',
    ]) {
      const verdict = classifyRenderer(string, { hardwareRequested: true });
      must(verdict.software_renderer === true, `'${string}' classified HARDWARE — this is the fail-open defect returning`);
      must(verdict.fell_back === true, `'${string}' did not report fell_back while hardware was requested`);
    }
    return 'five fail-open shapes, all SOFTWARE, all flagged as a fallback';
  });

  await arm('swiftshader/the-real-swiftshader-string-is-software', async () => {
    // Recorded in orchestration/status/FIRST-TEN-MINUTES.json from a real local capture run.
    const string = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)';
    const verdict = classifyRenderer(string, { hardwareRequested: true });
    must(verdict.software_renderer === true, 'SwiftShader classified HARDWARE');
    must(verdict.fell_back === true, 'a SwiftShader result while hardware was requested did not set fell_back');
    return 'SwiftShader → SOFTWARE, fell_back true';
  });

  await arm('manifest/evidence_class-follows-the-string-not-the-request', async () => {
    const fields = manifestRendererFields(classifyRenderer(
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)',
      { hardwareRequested: true },
    ));
    must(fields.software_renderer === true, 'manifest software_renderer was false on SwiftShader');
    must(fields.evidence_class.startsWith('SOFTWARE'), 'manifest evidence_class claimed HARDWARE on SwiftShader');
    must(fields.renderer_attestation.decided_from === 'renderer-string', 'the manifest did not record what the class was decided from');
    return 'a manifest built with hardware requested and SwiftShader delivered says SOFTWARE';
  });

  // --- the capture tools must all go through the one classifier -------------------------------
  await arm('wiring/every-capture-tool-uses-the-shared-classifier', async () => {
    const files = [
      'tools/visual/deck.mjs',
      'tools/visual/deck-motion.mjs',
      'tools/harness/vt-play.mjs',
      'tools/harness/vt-seethrough.mjs',
      'tools/harness/vt-world.mjs',
      'tools/harness/vt-playmode.mjs',
    ];
    const missing = files.filter((file) => {
      const source = fs.readFileSync(path.join(REPO, file), 'utf8');
      return !/renderer-class\.mjs|gpu-launch\.mjs/.test(source);
    });
    must(missing.length === 0, `these capture tools do not go through the shared renderer classifier: ${missing.join(', ')}`);
    return `${files.length} capture tools all route through tools/visual/lib/`;
  });

  await arm('estimate/the-cost-model-answers-with-a-number-and-its-basis', async () => {
    const deck = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/visual/deck.json'), 'utf8'));
    const full = estimate(planFor(deck, 'full'));
    must(full.stills === 288, `the full profile should be 288 stills, the model computed ${full.stills}`);
    must(full.sequences === 12, `the full profile should be 12 motion sequences, the model computed ${full.sequences}`);
    must(full.usd > 0 && full.total_min > 4, 'the estimate is not a positive number of minutes and dollars');
    must(full.suggested_max_runtime_min > full.total_min, 'the suggested runtime cap does not clear the estimate');
    return `full = ${full.stills} stills + ${full.motionFrames} motion frames ≈ ${full.total_min} min ≈ $${full.usd}`;
  });

  await arm('remote/the-batched-command-is-one-job-that-returns-one-tar', async () => {
    const command = remoteCommand({ profile: 'full', tag: 't', every: 1, withStills: true, withMotion: true, returnLevel: 'sample' });
    must(/deck\.mjs/.test(command) && /deck-motion\.mjs/.test(command), 'the batched command does not run both capture tools');
    must((command.match(/--require-hardware/g) || []).length === 2, 'a paid run did not demand hardware from both tools');
    must(/RUNPOD_ARTIFACT_DIR/.test(command), 'the command does not write into the artifact directory, so nothing would come back');
    must(!/curl|scp|ssh /.test(command), 'the command reaches for a transport other than the one tar');
    return 'one command, both tools, hardware required, one artifact directory';
  });

  const failed = results.filter((r) => !r.ok);
  if (json) console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
  else {
    for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? `\n      ${result.detail}` : ''}`);
    console.log(`\n${results.length - failed.length}/${results.length} arms green`);
  }
  return failed.length === 0;
}

// ---------------------------------------------------------------------------------------------
async function main() {
  if (args['self-test'] || args.selftest) {
    const ok = await selfTest({ json: Boolean(args.json) });
    process.exitCode = ok ? 0 : 1;
    return;
  }

  const deck = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/visual/deck.json'), 'utf8'));
  const profile = String(args.profile || 'smoke');
  const tag = String(args.tag || `gpu-${profile}`);
  const every = Number(args.every || 1);
  const frameCap = args.frames ? Number(args.frames) : null;
  const withStills = args['no-stills'] !== true;
  const withMotion = args['no-motion'] !== true;
  const returnLevel = String(args.return || 'sample');   // sheets | sample | all
  if (!['sheets', 'sample', 'all'].includes(returnLevel)) throw new Error(`--return must be sheets, sample or all`);

  const plan = planFor(deck, profile, { frameCap, every, withStills, withMotion });
  const e = estimate(plan);
  printEstimate(e, returnLevel);

  if (args.estimate || args['dry-run']) {
    console.log('\n--estimate: nothing was rented and nothing was spent.');
    console.log('\nthe command a real run would send to the Pod:\n');
    console.log(remoteCommand({ profile, tag, frameCap, every, withStills, withMotion, returnLevel }));
    return;
  }

  const maxRuntime = Number(args['max-runtime'] || e.suggested_max_runtime_min);
  if (maxRuntime < e.total_min) {
    console.error(`REFUSING: --max-runtime ${maxRuntime} is below the ${e.total_min} min estimate. The watchdog would kill the run after paying for the Pod and return nothing. Raise it, or shrink the profile.`);
    process.exitCode = 2;
    return;
  }

  const command = remoteCommand({ profile, tag, frameCap, every, withStills, withMotion, returnLevel });
  const artifactDir = String(args['artifact-dir'] || `reports/runpod-gpu/runs/deck-${tag}`);
  console.log(`\nrenting a Pod. Budget ${maxRuntime} min; artefacts land in ${artifactDir}\n`);

  // The RunPod CLI re-execs itself with NODE_USE_ENV_PROXY=1 (Node's global fetch ignores
  // HTTPS_PROXY without it, and every API call 403s). Going through the CLI rather than
  // importing run-http.mjs keeps that, and keeps the Pod cleanup path exactly as verified.
  const started = Date.now();
  const result = spawnSync(process.execPath, [
    path.join(REPO, 'tools/runpod/cli.mjs'), 'run',
    '--max-runtime', String(maxRuntime),
    '--artifact-dir', artifactDir,
    '--command', command,
  ], { stdio: 'inherit', cwd: REPO });
  const wallMin = (Date.now() - started) / 60000;

  const runJson = path.join(REPO, artifactDir, 'run.json');
  let actual = null;
  if (fs.existsSync(runJson)) {
    const state = JSON.parse(fs.readFileSync(runJson, 'utf8'));
    const price = state.pod?.pricePerHourUsd ?? COST_MODEL.usd_per_hour;
    actual = {
      pod: state.pod?.id || null,
      gpu: state.selectedOffer?.displayName || state.pod?.gpuTypeId || null,
      usd_per_hour: price,
      wall_min: +wallMin.toFixed(2),
      usd: +((wallMin / 60) * price).toFixed(3),
      status: state.status,
      artifact_files: state.artifactFiles,
      terminated: state.cleanup?.terminated === true,
    };
    fs.writeFileSync(path.join(REPO, artifactDir, 'deck-run.json'), `${JSON.stringify({ plan, estimate: e, actual, command }, null, 2)}\n`);
    console.log(`\nACTUAL: ${actual.gpu || 'GPU'} at $${actual.usd_per_hour}/hr for ${actual.wall_min} min = $${actual.usd} (estimated $${e.usd} / ${e.total_min} min)`);
    console.log(`Pod ${actual.pod} terminated: ${actual.terminated}`);
    console.log(`artefacts: ${path.join(artifactDir, 'artifacts')}`);
  }
  if (result.status !== 0) process.exitCode = result.status || 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`gpu-deck error: ${error.message}`);
    process.exitCode = 1;
  });
}
