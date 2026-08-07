#!/usr/bin/env node
/**
 * contention-test.mjs — the measurement the whole service exists for.
 *
 * A single agent doing a cold pack is NOT faster through the daemon; measured, it is about 40%
 * slower per frame, because the S34 settle proof renders three frames where the old path rendered
 * one. Reporting that as a win would be dishonest, and reporting only that would miss the point.
 *
 * The point is what happens when N agents want pictures AT THE SAME TIME. The old path gives each
 * of them a browser: fourteen agents drove this four-core box to load 44-103 and a 1280x720 frame
 * from 25 s to 150-260 s, and the W1-01 round-4 region pack managed three frames in twelve minutes
 * and was abandoned. The daemon gives all of them the same browser, so the multiplication cannot
 * happen — the frames queue instead of fighting.
 *
 * So this runs the SAME work — N agents x M frames each, at the same coordinates, in the same
 * window — twice:
 *
 *   DIRECT   N child processes, each booting its own browser (the old path)
 *   SERVICE  N child processes, all talking to one daemon
 *
 * and reports wall clock, per-frame cost, peak browser count (counted from /proc, not from
 * anybody's bookkeeping) and peak load average for each.
 *
 * USAGE
 *   node tools/capture/contention-test.mjs [--agents 4] [--frames 3] [--out reports/capture]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs, wantsHelp, usage, ensureDir, log, EXIT, REPO_ROOT, readJson } from '../lib/cli.mjs';
import { CaptureSession } from './client.mjs';

const USAGE = `contention-test.mjs — N agents at once, own browsers vs one shared browser.
  --agents <n>   concurrent agent processes (default 4)
  --frames <m>   frames each agent takes (default 3)
  --out <dir>    where to write CONTENTION.json (default reports/capture)`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const N = Number(args.agents || 4);
const M = Number(args.frames || 3);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/capture')));
ensureDir(OUT);
const WORK = path.join(REPO_ROOT, 'reports', 'runs', '.contention');
ensureDir(WORK);

/**
 * Browser processes on the box. SHARED BOX: other agents' browsers are in this count, so both
 * rounds report the delta from their own baseline and the comparison is delta-vs-delta.
 */
function browserCount() {
  let n = 0;
  for (const d of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue;
    let cmd; try { cmd = fs.readFileSync(`/proc/${d}/cmdline`, 'utf8'); } catch { continue; }
    if (!cmd) continue;
    const exe = cmd.split('\0')[0];
    if (/headless_shell|chrome|chromium/.test(exe) && !/--type=/.test(cmd)) n++;
  }
  return n;
}
const loadavg = () => Number(fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]);

const regions = readJson(path.join(REPO_ROOT, 'game/data/world/regions.json')).regions;
/** Distinct points per agent, so nobody is served another agent's cache entry by accident. */
const pointsFor = (agent) => Array.from({ length: M }, (_, k) => {
  const r = regions[(agent * 3 + k) % regions.length];
  const b = r.bounds_m;
  return {
    x: Math.round(b.x[0] + (b.x[1] - b.x[0]) * (0.35 + 0.07 * k + 0.02 * agent)),
    z: Math.round(b.z[0] + (b.z[1] - b.z[0]) * (0.45 + 0.05 * k + 0.02 * agent)),
    yaw: (agent * 90 + k * 37) % 360,
  };
});

// ---- the two agent programs, written to disk so they run as real separate processes ----------
const AGENT_DIRECT = path.join(WORK, 'agent-direct.mjs');
const AGENT_SERVICE = path.join(WORK, 'agent-service.mjs');
fs.writeFileSync(AGENT_DIRECT, `
// One agent, its own browser — the path this service replaces.
import { launchGame } from '${path.join(REPO_ROOT, 'tools/lib/browser.mjs')}';
const pts = JSON.parse(process.argv[2]);
const t0 = Date.now();
const h = await launchGame({ width: 1280, height: 720 });
const boot = Date.now() - t0;
try {
  await h.h('setSeed', 1337); await h.h('loadState', 'default');
  await h.hOpt('setUIVisible', false);
  for (const p of pts) {
    const g = await h.h('getTerrainAt', p.x, p.z);
    await h.h('teleport', p.x, p.z);
    await h.h('streamAround', p.x, p.z);
    await h.h('setTimeOfDay', 11); await h.h('setWeather', 'clear');
    const yaw = p.yaw * Math.PI / 180, ey = (g && g.y || 0) + 1.7;
    await h.h('camera', { pos: [p.x, ey, p.z], look: [p.x + Math.sin(yaw) * 40, ey - 3, p.z + Math.cos(yaw) * 40], fov: 70 });
    await h.h('stepFrames', 24);
    await h.h('renderFrame');
    await h.page.screenshot({ path: process.argv[3] + '-' + p.x + '-' + p.z + '.png', type: 'png', animations: 'disabled', timeout: 600000 });
  }
} finally { await h.close(); }
process.stdout.write(JSON.stringify({ boot_ms: boot, total_ms: Date.now() - t0 }) + '\\n');
`);
fs.writeFileSync(AGENT_SERVICE, `
// One agent, the shared daemon.
import { CaptureSession } from '${path.join(REPO_ROOT, 'tools/capture/client.mjs')}';
import fs from 'node:fs';
const pts = JSON.parse(process.argv[2]);
const t0 = Date.now();
const s = new CaptureSession();
await s.connect();
const boot = Date.now() - t0;
try {
  for (const p of pts) {
    const r = await s.capture({
      evidence_of: 'appearance', claim: 'contention benchmark frame',
      place: { x: p.x, z: p.z }, pose: { yaw_deg: p.yaw, pitch_deg: 4.3, eye_m: 1.7, fov: 70 },
      time: 11, weather: 'clear', width: 1280, height: 720, no_cache: true,
    });
    fs.copyFileSync(r.path, process.argv[3] + '-' + p.x + '-' + p.z + '.png');
  }
} finally { s.close(); }
process.stdout.write(JSON.stringify({ boot_ms: boot, total_ms: Date.now() - t0 }) + '\\n');
`);

function runRound(script, tag) {
  return new Promise((resolve) => {
    const baseBrowsers = browserCount(), baseLoad = loadavg();
    let peakBrowsers = baseBrowsers, peakLoad = baseLoad, samples = 0;
    const watch = setInterval(() => {
      samples++;
      const b = browserCount(); if (b > peakBrowsers) peakBrowsers = b;
      const l = loadavg(); if (l > peakLoad) peakLoad = l;
    }, 500);
    const t0 = Date.now();
    let done = 0;
    const per = [];
    for (let a = 0; a < N; a++) {
      const pts = JSON.stringify(pointsFor(a));
      const outPrefix = path.join(WORK, `${tag}-a${a}`);
      const t1 = Date.now();
      const c = spawn(process.execPath, [script, pts, outPrefix], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
      let so = '', se = '';
      c.stdout.on('data', (d) => { so += d; });
      c.stderr.on('data', (d) => { se += d; });
      c.on('exit', (code) => {
        let stat = null; try { stat = JSON.parse(so.trim().split('\n').pop()); } catch { /* */ }
        per.push({ agent: a, ms: Date.now() - t1, code, boot_ms: stat && stat.boot_ms, err: code ? se.slice(-300) : undefined });
        if (++done === N) {
          clearInterval(watch);
          resolve({
            wall_ms: Date.now() - t0,
            browsers_before: baseBrowsers, peak_browsers: peakBrowsers,
            browsers_added: peakBrowsers - baseBrowsers,
            load_before: baseLoad, peak_load: peakLoad, samples, per,
          });
        }
      });
    }
  });
}

log(`round 1: ${N} agents x ${M} frames, EACH WITH ITS OWN BROWSER`);
const direct = await runRound(AGENT_DIRECT, 'direct');
log(`  wall ${(direct.wall_ms / 1000).toFixed(1)} s, browsers +${direct.browsers_added} (${direct.browsers_before} -> ${direct.peak_browsers}), load ${direct.load_before} -> ${direct.peak_load}`);

// Let the box settle so round 2 does not inherit round 1's load.
await new Promise((r) => setTimeout(r, 15000));

const s = new CaptureSession();
try { await s.connect(); await s.send('stop', {}); } catch { /* */ } finally { s.close(); }
await new Promise((r) => setTimeout(r, 2000));

log(`round 2: ${N} agents x ${M} frames, ALL SHARING ONE DAEMON`);
const service = await runRound(AGENT_SERVICE, 'service');
log(`  wall ${(service.wall_ms / 1000).toFixed(1)} s, browsers +${service.browsers_added} (${service.browsers_before} -> ${service.peak_browsers}), load ${service.load_before} -> ${service.peak_load}`);

const frames = N * M;
const report = {
  schema: 'elder-souls/capture-contention@1',
  ran_at: new Date().toISOString(),
  agents: N, frames_per_agent: M, frames_total: frames,
  direct: {
    ...direct,
    wall_s: +(direct.wall_ms / 1000).toFixed(1),
    s_per_frame: +(direct.wall_ms / 1000 / frames).toFixed(2),
    all_ok: direct.per.every((p) => p.code === 0),
  },
  service: {
    ...service,
    wall_s: +(service.wall_ms / 1000).toFixed(1),
    s_per_frame: +(service.wall_ms / 1000 / frames).toFixed(2),
    all_ok: service.per.every((p) => p.code === 0),
  },
  browsers_added_direct_vs_service: `${direct.browsers_added} vs ${service.browsers_added}`,
  note: 'the box is shared with other agents; only the delta from each round\'s own baseline is attributable',
  speedup: +(direct.wall_ms / service.wall_ms).toFixed(2),
  verdict: service.browsers_added <= 1 && direct.browsers_added > 1
    ? `${service.browsers_added} browser added instead of ${direct.browsers_added}; wall clock ${direct.wall_ms > service.wall_ms ? 'improved' : 'regressed'} ${(direct.wall_ms / service.wall_ms).toFixed(2)}x`
    : `INCONCLUSIVE: browsers added direct=${direct.browsers_added} service=${service.browsers_added}`,
};
fs.writeFileSync(path.join(OUT, 'CONTENTION.json'), JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
process.exit(report.direct.all_ok && report.service.all_ok ? EXIT.OK : EXIT.MEASUREMENT_FAIL);
