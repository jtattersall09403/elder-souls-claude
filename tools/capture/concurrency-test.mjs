#!/usr/bin/env node
/**
 * concurrency-test.mjs — what happens when N agents ask at once.
 *
 * This is the claim the whole service exists to make good on, so it is measured rather than
 * asserted. Three things must be true:
 *
 *  1. N SEPARATE PROCESSES asking for overlapping captures spawn ONE browser, not N. Counted from
 *     `headless_shell` / `chrome` processes on the box, not from the daemon's own bookkeeping —
 *     a daemon that miscounts its own browsers would report success either way.
 *  2. Overlapping requests are served ONCE and shared. Identical specs from different agents must
 *     produce the same file with the same sha256, and all but the first must be cache hits.
 *  3. A big job does not starve a small one. With a 40-frame pack queued on one connection, a
 *     second client asking for a single frame waits about ONE frame, not forty.
 *
 * Each "agent" is a real child process running the real client, because the thing under test is
 * exactly what happens between processes.
 *
 * USAGE
 *   node tools/capture/concurrency-test.mjs [--agents 6] [--out reports/capture]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { parseArgs, wantsHelp, usage, ensureDir, log, EXIT, REPO_ROOT, readJson } from '../lib/cli.mjs';
import { CaptureSession } from './client.mjs';

const USAGE = `concurrency-test.mjs — N agents, one browser.
  --agents <n>   how many concurrent client PROCESSES (default 6)
  --out <dir>    where to write CONCURRENCY.json (default reports/capture)`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const N = Number(args.agents || 6);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/capture')));
ensureDir(OUT);

/** Browser processes on the box, counted from /proc rather than from the daemon's own opinion. */
function browserCount() {
  let n = 0;
  const names = [];
  for (const d of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue;
    let cmd;
    try { cmd = fs.readFileSync(`/proc/${d}/cmdline`, 'utf8'); } catch { continue; }
    if (!cmd) continue;
    const exe = cmd.split('\0')[0];
    // Only the browser's own main process: renderer/GPU children carry --type=.
    if (/headless_shell|chrome|chromium/.test(exe) && !/--type=/.test(cmd)) { n++; names.push(exe.split('/').pop()); }
  }
  return { n, names };
}

const runShot = (argv) => new Promise((resolve) => {
  const t0 = Date.now();
  execFile(process.execPath, [path.join(REPO_ROOT, 'tools/harness/shot.mjs'), ...argv, '--json'],
    { cwd: REPO_ROOT, maxBuffer: 1 << 24 },
    (err, stdout, stderr) => {
      let manifest = null;
      try { manifest = JSON.parse(stdout); } catch { /* */ }
      resolve({ ms: Date.now() - t0, ok: !err, manifest, stderr: String(stderr).slice(-400) });
    });
});

const regions = readJson(path.join(REPO_ROOT, 'game/data/world/regions.json')).regions;
const pt = (r, k) => {
  const b = r.bounds_m;
  return { x: Math.round(b.x[0] + (b.x[1] - b.x[0]) * (0.4 + 0.05 * k)), z: Math.round(b.z[0] + (b.z[1] - b.z[0]) * (0.5 + 0.03 * k)) };
};

const results = {};

// -------------------------------------------------------------------------------------------
// 1 + 2: N processes, overlapping requests, from a COLD daemon (so the race to start it is real)
// -------------------------------------------------------------------------------------------
{
  // Stop anything running, so N agents genuinely race to start the daemon.
  const s0 = new CaptureSession();
  try { await s0.connect(); await s0.send('stop', {}); } catch { /* not running */ } finally { s0.close(); }
  await new Promise((r) => setTimeout(r, 1500));
  const before = browserCount();

  // Half the agents ask for the SAME picture, half for distinct ones — so the run tests both
  // sharing and queueing at once.
  //
  // No `--no-cache` on the shared half, deliberately: the claim under test is that an overlapping
  // request is RENDERED ONCE AND SHARED, and `--no-cache` would make every one of them render and
  // then pass the sha256 check for the wrong reason (the renders are deterministic). Instead the
  // yaw carries a per-run nonce so the picture is not already in the cache, and the assertion is
  // that exactly ONE of the overlapping agents rendered it and the rest were served it.
  const NONCE = Math.floor(Math.random() * 100000);
  const sharedYaw = String((NONCE % 360));
  const shared = pt(regions[0], 0);
  const argvs = [];
  for (let i = 0; i < N; i++) {
    const same = i % 2 === 0;
    const p = same ? shared : pt(regions[i % regions.length], i);
    argvs.push(['--at', `${p.x},${p.z}`, '--yaw', same ? sharedYaw : String((NONCE + 40 + i) % 360),
      '--time', '11', '--weather', 'clear', '--width', '960', '--height', '540']);
  }
  // A sampler that watches the box while the agents run.
  let peak = before.n, samples = 0;
  const watcher = setInterval(() => { const c = browserCount(); samples++; if (c.n > peak) peak = c.n; }, 250);
  const t0 = Date.now();
  const out = await Promise.all(argvs.map(runShot));
  clearInterval(watcher);
  const after = browserCount();

  const sameSpec = out.filter((_, i) => i % 2 === 0);
  const shas = new Set(sameSpec.map((r) => r.manifest && r.manifest.sha256).filter(Boolean));
  const rendered = sameSpec.filter((r) => r.manifest && r.manifest.cached === false).length;
  const served = sameSpec.filter((r) => r.manifest && r.manifest.cached === true).length;

  results.n_agents_one_browser = {
    what: `${N} separate client processes, ${Math.ceil(N / 2)} of them asking for the SAME capture, all started at once against a cold daemon`,
    must: 'exactly ONE browser process on the box, and the overlapping requests share one picture',
    agents: N,
    browsers_before: before.n,
    browsers_peak_during: peak,
    browsers_after: after.n,
    samples,
    wall_ms: Date.now() - t0,
    all_succeeded: out.every((r) => r.ok),
    per_agent_ms: out.map((r) => r.ms),
    overlapping_requests: sameSpec.length,
    overlapping_rendered: rendered,
    overlapping_served_from_cache: served,
    distinct_sha256_among_overlapping: shas.size,
    pass: peak <= 1 && out.every((r) => r.ok) && shas.size === 1 && rendered === 1 && served === sameSpec.length - 1,
  };
  log(`N=${N} agents: peak browsers=${peak} (before ${before.n}), all ok=${out.every((r) => r.ok)}; ` +
    `overlapping: ${rendered} rendered + ${served} served from cache, ${shas.size} distinct sha256`);
}

// -------------------------------------------------------------------------------------------
// 3: fairness — a big job must not starve a small one
// -------------------------------------------------------------------------------------------
{
  const big = new CaptureSession();
  await big.connect();
  const BIG = 40;
  const bigSpecs = [];
  for (let i = 0; i < BIG; i++) {
    const p = pt(regions[i % regions.length], i);
    bigSpecs.push({ evidence_of: 'appearance', place: p, pose: { yaw_deg: (i * 37) % 360, pitch_deg: 4, eye_m: 1.7, fov: 70 }, time: 11, weather: 'clear', width: 640, height: 360, no_cache: true });
  }
  // Fire the whole pack onto ONE connection without awaiting, so it is genuinely queued.
  const bigPromises = bigSpecs.map((sp) => big.capture(sp).catch((e) => ({ error: e.code })));
  await new Promise((r) => setTimeout(r, 400));   // let them all land in the daemon's queue

  const small = new CaptureSession();
  await small.connect();
  const t0 = Date.now();
  const one = await small.capture({ evidence_of: 'appearance', place: pt(regions[2], 9), pose: { yaw_deg: 123, pitch_deg: 4, eye_m: 1.7, fov: 70 }, time: 11, weather: 'clear', width: 640, height: 360, no_cache: true });
  const smallMs = Date.now() - t0;
  small.close();

  const bigOut = await Promise.all(bigPromises);
  const perFrame = bigOut.filter((r) => r && r.render_ms).map((r) => r.render_ms).sort((a, b) => a - b);
  const median = perFrame.length ? perFrame[Math.floor(perFrame.length / 2)] : null;
  big.close();

  results.fairness = {
    what: `a ${BIG}-frame pack queued on one connection, then a second client asks for one frame`,
    must: 'the single frame waits about ONE frame, not the whole pack',
    big_frames: BIG,
    big_median_render_ms: median,
    small_wait_ms: smallMs,
    fifo_would_have_been_ms: median ? median * BIG : null,
    speedup_vs_fifo: median ? +(median * BIG / smallMs).toFixed(1) : null,
    small_settled: !!(one && one.settle && one.settle.settled),
    // The bar: the small request must complete in less than four frame times. Under strict FIFO
    // it would take BIG frame times.
    pass: !!median && smallMs < median * 4,
  };
  log(`fairness: pack median ${median} ms/frame; the one-frame client waited ${smallMs} ms (FIFO would be ~${median ? median * BIG : '?'} ms)`);
}

const failed = Object.entries(results).filter(([, v]) => !v.pass).map(([k]) => k);
const report = {
  schema: 'elder-souls/capture-concurrency@1',
  ran_at: new Date().toISOString(),
  verdict: failed.length ? 'FAILED: ' + failed.join(', ') : 'ONE BROWSER, SHARED AND FAIR',
  results,
};
fs.writeFileSync(path.join(OUT, 'CONCURRENCY.json'), JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
process.exit(failed.length ? EXIT.MEASUREMENT_FAIL : EXIT.OK);
