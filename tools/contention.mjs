#!/usr/bin/env node
// contention.mjs — how loaded is this box, really, and may I launch a browser?
//
// Written because rule 21 has been throttling the whole fleet on a number that does not mean what
// the rule thinks it means. The rule says "keep `pgrep -c headless_shell` under ~8". But Chromium
// forks a process tree per launch — a browser process, a zygote, a GPU process and one renderer per
// tab — so ONE browser shows up as several `headless_shell` entries.
//
// And the multiplier is not a constant, which is the real argument for this tool. Two readings a
// few hours apart on the same box: 43 processes were 6 browsers (7.2 each), and 26 processes were
// also 6 browsers (4.3 each). It depends on how many tabs each run holds open and whether the GPU
// process has started yet. So there is no divisor you could apply to the old number to recover the
// right one — the old number was not a scaled version of the truth, it was noise with a trend.
//
// (A blog writer caught the first version of this comment claiming "43 processes were SIX browsers"
// while the commit message beside it said 36. Both readings were real, taken minutes apart; neither
// was written down at the time. That is the same failure this project charges builders for, so it
// is recorded here rather than quietly corrected.)
//
// Under the rule as written the safe ceiling was about one and a third browsers, and agents have
// been queueing, sleeping and skipping measurements to respect it.
//
// The honest metric is the number of browser *instances* (a headless_shell whose parent is not
// itself a headless_shell) and the run-queue length per core. Those are what actually contend.
//
//   node tools/contention.mjs            # a report
//   node tools/contention.mjs --gate     # exit 0 if it is fine to launch, 3 if you should wait
//
// Exit 3 is advisory in the same sense a red gate is advisory: you may proceed, but you must say
// in your status file that you did and why.
import { execSync } from 'node:child_process';
import { cpus, loadavg } from 'node:os';

/** Every headless_shell pid, with its parent, in one ps call. */
function browserProcs() {
  let out = '';
  try { out = execSync('ps -eo pid,ppid,stat,comm,rss', { encoding: 'utf8' }); } catch { return []; }
  const rows = [];
  for (const line of out.split('\n').slice(1)) {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\d+)$/);
    // PID 1 in some CI containers does not reap Chromium children.  A zombie has no CPU, memory,
    // tab or browser instance left to contend with; counting it made the gate permanently red
    // after otherwise clean runs.  Ignore only ps' explicit Z state, never a merely idle process.
    if (m && !m[3].startsWith('Z')) rows.push({ pid: +m[1], ppid: +m[2], stat: m[3], comm: m[4], rssKb: +m[5] });
  }
  return rows;
}

const all = browserProcs();
const shells = all.filter(r => /headless_shell|chrome|chromium/.test(r.comm));
const shellPids = new Set(shells.map(r => r.pid));
// A browser INSTANCE is a shell process whose parent is not also a shell — i.e. the one somebody
// actually launched. Everything under it is that same browser's own fork tree, not a second user
// of the CPU in any sense the launcher controls.
const instances = shells.filter(r => !shellPids.has(r.ppid));

const cores = cpus().length || 1;
const [l1] = loadavg();
const perCore = l1 / cores;
const rssMb = Math.round(shells.reduce((a, r) => a + r.rssKb, 0) / 1024);

// Thresholds. One browser per core is the point at which SwiftShader rasterisation starts trading
// wall-clock for nothing: the renderers are CPU-bound, so a seventh browser on four cores does not
// finish sooner, it makes the other six slower. Run-queue is the backstop for non-browser load
// (test runs, builds, the province streamer) that the instance count cannot see.
const MAX_INSTANCES = cores + 2;      // 6 on this box
const MAX_PER_CORE = 4.0;             // load average per core before new work is self-defeating

const busy = instances.length >= MAX_INSTANCES || perCore >= MAX_PER_CORE;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ instances: instances.length, processes: shells.length, cores, load1: l1, perCore, rssMb, busy }, null, 2));
} else {
  console.log(`contention: ${instances.length} browser instance(s) — ${shells.length} process(es), ${rssMb} MB resident`);
  console.log(`            load ${l1.toFixed(2)} over ${cores} core(s) = ${perCore.toFixed(2)} per core`);
  console.log(`            ceilings: ${MAX_INSTANCES} instances, ${MAX_PER_CORE.toFixed(1)} per core`);
  if (shells.length && instances.length) {
    console.log(`            (a browser is ${(shells.length / instances.length).toFixed(1)} processes here — this is why`);
    console.log(`             \`pgrep -c headless_shell\` is NOT the number to throttle on)`);
  }
  console.log(busy
    ? `\nWAIT — the box is at or over its ceiling. Use the pooled capture daemon in tools/capture/,\n       or take an offline measurement, or wait. If you proceed anyway, say so in your status file.`
    : `\nGO — room for ${Math.max(0, MAX_INSTANCES - instances.length)} more browser instance(s).`);
}

if (process.argv.includes('--gate')) process.exit(busy ? 3 : 0);
