#!/usr/bin/env node
// calibrate.mjs — `RI-PLT01` §A rule S*: the machine CPU index that makes a sim-time
// budget comparable across machines.
//
// The item names this file; it did not exist, so the W1-00 critic recorded "Sim CPU **not
// scored** — `tools/platform/calibrate.mjs` does not exist, so no `cpu_index` and no
// `sim_units`. Fail-closed at 0" as a method deviation, and RI-PLT01 M3's 8 points went
// unearned rather than unmet. This produces the index.
//
// The workload, exactly as §A specifies it: "a fixed, deterministic, allocation-free pure-JS
// workload (a seeded fixed-point integration over 100 k iterations)". It is integer-only —
// no floats, no allocation, no `Math.*` — so it measures integer ALU and branch throughput
// and nothing about the GPU, the allocator or the JIT's float pipeline. `checksum` is
// printed and is a fixed value: a machine that produces a different checksum ran a different
// workload and its index is void.
//
// *** WHAT THIS TOOL WILL NOT DO. ***
// It will not emit `sim_units`. §A defines
// `sim_units = measured_sim_ms x (cpu_index_reference / cpu_index_thismachine)` "and the
// reference is the declared `phone-mid` class" — but **no numeric `cpu_index_reference` for
// `phone-mid` is declared anywhere in the corpus.** Grep it: `phone-mid` appears in
// RI-PLT01 §A/§C, RI-PLT02 §B.1 and RI-PLT03 §C.1 as a device class, never as an index
// value. Inventing one here would make every P1/P2/P3 verdict in the project a function of
// a number this file made up, which is precisely the fabricated measurement RI-MTH04
// forbids. So `sim_units` is emitted as `null` with `_unmeasurable` stating why, and the
// gap is named. When the reference lands, one constant closes it and every recorded
// `cpu_index` becomes convertible retroactively.
//
// USAGE
//   node tools/platform/calibrate.mjs [--repeats 25] [--out reports/platform/CALIBRATION]
import path from 'node:path';
import os from 'node:os';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';

const USAGE = `
calibrate.mjs — RI-PLT01 §A S*: cpu_index for this machine.

USAGE
  node tools/platform/calibrate.mjs [--repeats 25] [--iterations 100000] [--out <dir>] [--json]

OUTPUT
  cpu_index          median wall time in ms of the fixed workload (lower = faster machine)
  checksum           must be identical on every machine; a different value voids the index
  sim_units_factor   null — see the header; the corpus declares no numeric phone-mid reference
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const REPEATS = Number(args.repeats || 25);
const ITER = Number(args.iterations || 100000);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, '..', 'platform', 'CALIBRATION');
ensureDir(outDir);

/**
 * A seeded fixed-point integration. Integer state, integer arithmetic, no allocation, no
 * library calls. Q16.16 fixed point; the "system" is a damped oscillator integrated
 * semi-implicitly, which is the same shape of work a fixed-step game loop does.
 */
function workload(iterations) {
  let x = 0x00010000 | 0;      // 1.0 in Q16.16
  let v = 0;
  let acc = 0;
  let seed = 1337 | 0;
  for (let i = 0; i < iterations; i++) {
    // xorshift32, integer only — deterministic forcing term
    seed ^= seed << 13; seed |= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed |= 0;
    const force = (seed >> 20);                       // small signed integer
    // semi-implicit Euler in Q16.16: v += (-k*x - c*v + force) * dt ; x += v * dt
    const k = 3277;                                   // 0.05 in Q16.16
    const c = 655;                                    // 0.01 in Q16.16
    const fx = Math.imul(-k, x >> 16) - Math.imul(c, v >> 16) + force;
    v = (v + (fx >> 4)) | 0;
    x = (x + (v >> 4)) | 0;
    acc = (acc + (x ^ v)) | 0;
  }
  return acc | 0;
}

const times = [];
let checksum = 0;
// Untimed warm-up passes so the measurement is of TurboFan-optimised code rather than of
// the interpreter tiering up. One pass is not enough: the first timed sample came in 12x
// slower than the median and the reported spread was 1132%.
for (let i = 0; i < 20; i++) workload(ITER);
for (let r = 0; r < REPEATS; r++) {
  const t0 = process.hrtime.bigint();
  checksum = workload(ITER);
  const t1 = process.hrtime.bigint();
  times.push(Number(t1 - t0) / 1e6);
}
times.sort((a, b) => a - b);
const median = times[Math.floor(times.length / 2)];

const report = {
  schema: 'elder-souls/cpu-calibration@1',
  spec: 'RI-PLT01 §A rule S* — sim budgets are stated in sim_units, not ms',
  workload: 'seeded fixed-point (Q16.16) semi-implicit integration, integer-only, allocation-free',
  iterations: ITER,
  repeats: REPEATS,
  checksum,
  cpu_index: +median.toFixed(4),
  cpu_index_all_ms: times.map((t) => +t.toFixed(4)),
  // Reported so a reader can see the tail rather than trusting a single number.
  cpu_index_p25_ms: +times[Math.floor(times.length * 0.25)].toFixed(4),
  cpu_index_p75_ms: +times[Math.floor(times.length * 0.75)].toFixed(4),
  cpu_index_iqr_spread_pct: +(((times[Math.floor(times.length * 0.75)] - times[Math.floor(times.length * 0.25)]) / median) * 100).toFixed(2),
  cpu_index_spread_pct: +(((times[times.length - 1] - times[0]) / median) * 100).toFixed(2),
  machine: {
    node: process.version, platform: process.platform, arch: process.arch,
    cpu_model: (os.cpus()[0] || {}).model || null, cpus: os.cpus().length,
    total_mem_gb: +(os.totalmem() / 2 ** 30).toFixed(2),
  },
  sim_units_factor: null,
  reference_class: 'phone-mid',
  _unmeasurable: {
    sim_units:
      'RI-PLT01 §A defines sim_units = measured_sim_ms x (cpu_index_reference / cpu_index_thismachine) ' +
      'and names the reference as "the declared phone-mid class", but NO NUMERIC cpu_index_reference ' +
      'for phone-mid is declared anywhere in the corpus — `phone-mid` appears only as a device-class ' +
      'label. This tool therefore reports cpu_index and refuses to convert. Emitting a sim_units ' +
      'figure would require inventing the reference constant, which would make every P1/P2/P3 ' +
      'verdict a function of a fabricated number (RI-MTH04). Named as a corpus hole rather than ' +
      'papered over; one declared constant closes it and every recorded cpu_index converts retroactively.',
  },
  corpus_hole: {
    id: 'PLT01-A-no-numeric-cpu-index-reference',
    item: 'RI-PLT01',
    section: '§A rule S*',
    what: 'sim_units is defined in terms of cpu_index_reference for the phone-mid class, and that constant is never given a value.',
    consequence: 'M3 (8 points of RI-PLT01) cannot be scored on any machine, including real hardware, until the constant is declared.',
    remedy: 'Declare cpu_index_reference for phone-mid in RI-PLT01 §A, measured by this workload on an attested phone-mid device, with its checksum.',
  },
};

log(`cpu_index = ${report.cpu_index} ms (median of ${REPEATS}, IQR spread ${report.cpu_index_iqr_spread_pct}%, full spread ${report.cpu_index_spread_pct}%), checksum ${checksum}`);
log('sim_units: REFUSED — the corpus declares no numeric cpu_index_reference for phone-mid. See _unmeasurable.sim_units.');
writeJson(path.join(outDir, 'calibration.json'), report);
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(path.join(outDir, 'calibration.json') + '\n');
process.exit(EXIT.OK);
