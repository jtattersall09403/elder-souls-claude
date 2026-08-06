#!/usr/bin/env node
// perf-probe.mjs — the Tier-S half of RI-PLT01, and only that half.
//
// RI-PLT01 rule T1 is binding: a Tier-H number (fps, frame time, TTFP wall clock, hitch
// duration) may NOT be emitted from a run whose renderer string is SwiftShader, llvmpipe,
// software or Mesa — "not a low one, not a provisional one". This tool reads
// WEBGL_debug_renderer_info first and refuses to print a Tier-H field when the renderer is
// software. Rule T2 also applies: the unmeasurable checks stay in the denominator, so the
// output states the Tier-S ceiling rather than normalising it away.
//
// What it measures (all Tier-S, all valid here):
//   S1/S2   draw calls and triangles per frame, per scenario, MAX not mean
//   S3-S9   programs, materials, state changes, skinned meshes, shadow lights, memory
//   P1-P3   CPU sim time per fixed step with rendering DISABLED, in ms and in sim_units
//   P4      bytes allocated per fixed step (heap delta over N steps after a forced GC)
//   P8/P9   sim/render decoupling: step count and trace hash at 60/30/15/0 Hz render
//   M9      integer-step audit: t_ms deltas and f increments over a whole run
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame, DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';

const USAGE = `
perf-probe.mjs — RI-PLT01 Tier-S measurements. Refuses to emit Tier-H on a software renderer.

USAGE
  node tools/platform/perf-probe.mjs [--frames 3000] [--out <dir>]

OPTIONS
  --frames <n>   Steps per measurement (default 3000)
  --entry <path> HTML entry (default game/index.html)
  --out <dir>    Output directory (default reports/platform/TIER-S)
  --json         Print the report
  --help         This message
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const FRAMES = Number(args.frames || 3000);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, '..', 'platform', 'TIER-S');
ensureDir(outDir);

// --expose-gc so the allocation probe can force a collection (A-JRN9, partial).
const handle = await launchGame({ ...args, chromiumArgs: [...DETERMINISTIC_CHROMIUM_ARGS, '--js-flags=--expose-gc'] });
let report;
try {
  report = await handle.page.evaluate(async (frames) => {
    const H = window.__HARNESS;
    await H.ready();
    const out = { schema: 'elder-souls/perf-probe@1', tier: 'S', frames };

    // ---- renderer attestation (RI-PLT01 T1) ------------------------------------------
    const gl = document.createElement('canvas').getContext('webgl2');
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const unmasked = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
    const software = /swiftshader|llvmpipe|software|mesa/i.test(String(unmasked));
    out.renderer = {
      unmaskedRenderer: String(unmasked),
      software,
      deviceClass: software ? null : 'unknown',
      tierH_emitted: false,
      tierH_reason: software
        ? 'RI-PLT01 rule T1: this is a software rasteriser. Every Tier-H check scores unmeasurable = 0, fail-closed, and stays in the denominator (rule T2). The Tier-S ceiling is 64/100.'
        : 'a real GPU string was found, but this tool does not implement the Tier-H measurements',
    };

    // ---- calibration: a fixed, allocation-free pure-JS workload (RI-PLT01 S*) ----------
    const calibrate = () => {
      let a = 1 | 0, b = 2 | 0, acc = 0;
      const t0 = performance.now();
      for (let i = 0; i < 100000; i++) {
        a = (a * 1103515245 + 12345) | 0;
        b = (b ^ (a >>> 7)) | 0;
        acc = (acc + (b & 0xffff)) | 0;
      }
      return { ms: performance.now() - t0, checksum: acc };
    };
    const cal = calibrate();
    out.cpu_index = { ms: +cal.ms.toFixed(4), checksum: cal.checksum,
      note: 'sim_units = measured_sim_ms x (cpu_index_reference / cpu_index_thismachine). No phone-mid reference has been taken, so sim_units cannot be computed and raw ms is reported with that stated (RI-PLT01 S*).' };

    // ---- P1-P3: sim CPU per fixed step, render DISABLED -------------------------------
    const simTiming = (state, n) => {
      H.setSeed(1337); H.loadState(state); H.setRenderRate(0);
      H.stepFrames(120);
      const samples = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const t0 = performance.now();
        H.stepFrames(1);
        samples[i] = performance.now() - t0;
      }
      const arr = Array.from(samples).sort((a, b) => a - b);
      return {
        p50: +arr[Math.floor(n * 0.5)].toFixed(5),
        p99: +arr[Math.floor(n * 0.99)].toFixed(5),
        max: +arr[n - 1].toFixed(5),
        mean: +(arr.reduce((s, x) => s + x, 0) / n).toFixed(5),
      };
    };
    out.sim_cpu_ms = {
      F1_exterior: simTiming('default', Math.min(frames, 3000)),
      F5_dungeon: simTiming('dungeon_primary', Math.min(frames, 3000)),
    };

    // ---- P4: bytes allocated per fixed step -------------------------------------------
    const allocProbe = (state, n) => {
      H.setSeed(1337); H.loadState(state); H.setRenderRate(0);
      H.stepFrames(240);                                     // reach steady state
      if (typeof gc === 'function') gc();
      const before = performance.memory ? performance.memory.usedJSHeapSize : null;
      if (before === null) return { supported: false };
      H.stepFrames(n);
      const after = performance.memory.usedJSHeapSize;
      return { supported: true, bytes_per_step: +((after - before) / n).toFixed(1), steps: n, heap_before: before, heap_after: after };
    };
    out.alloc_per_step = {
      F1_exterior: allocProbe('default', 3000),
      F5_dungeon: allocProbe('dungeon_primary', 3000),
      note: 'The trace record is excluded by name (RI-PLT01 P4) and tracing is OFF during this probe. performance.memory is a coarse instrument; a CDP Runtime.getHeapUsage probe (A-JRN9) is the stronger measurement and belongs to the runner.',
    };

    // ---- S1-S9: scene budget, MAX over the run, per scenario --------------------------
    const sceneBudget = (state) => {
      H.setSeed(1337); H.loadState(state); H.setRenderRate(60);
      let dc = 0, tri = 0;
      for (let i = 0; i < 24; i++) { H.stepFrames(10); const p = H.getPerfStats(); dc = Math.max(dc, p.drawCalls); tri = Math.max(tri, p.triangles); }
      const p = H.getPerfStats();
      return {
        drawCalls_max: dc, triangles_max: tri,
        programs: p.programsBound, materials: p.materials, stateChanges: p.stateChanges,
        skinnedMeshes: p.skinnedMeshes, shadowLights: p.shadowLights,
        textureMB: p.textureMB, geometryMB: p.geometryMB,
      };
    };
    out.scene_budget = {
      F1_fen_exterior: sceneBudget('default'),
      F2_settlement: sceneBudget('settlement_primary_street'),
      F3_arena: sceneBudget('arena_flat'),
      F5_dungeon: sceneBudget('dungeon_primary'),
    };

    // ---- P8/P9: sim/render decoupling --------------------------------------------------
    const decouple = (hz) => {
      H.setSeed(1337); H.loadState('arena_flat');
      H.setRenderRate(hz);
      H.spawn('inf_trash', 0, 7, { as: 'e0' });
      H.aggro('e0');
      H.stepFrames(30);
      H.queueInputs([{ f: 0, move: [0, 1] }, { f: 60, tap: 'light' }, { f: 200, tap: 'roll', hold: 3 }]
        .map((e) => (e.tap ? { f: e.f, press: [e.tap] } : e)));
      const f0 = H.getFrame();
      H.traceStart({ enemies: true, hitboxes: true, events: true });
      H.stepFrames(600);
      const recs = H.traceStop();
      let s = '';
      for (const r of recs) s += JSON.stringify(r) + '\\n';
      return { hz, steps: H.getFrame() - f0, records: recs.length, body: s };
    };
    const runs = [60, 30, 15, 0].map(decouple);
    out.decoupling = runs.map((r) => ({ render_hz: r.hz, sim_steps: r.steps, records: r.records }));
    out._bodies = runs.map((r) => r.body);

    // ---- M9: integer-step audit ---------------------------------------------------------
    H.setSeed(1337); H.loadState('default'); H.setRenderRate(0);
    H.traceStart({});
    H.stepFrames(1200);
    const audit = H.traceStop();
    let badF = 0, badT = 0, maxErr = 0;
    for (let i = 1; i < audit.length; i++) {
      if (audit[i].f !== audit[i - 1].f + 1) badF++;
      const d = audit[i].t_ms - audit[i - 1].t_ms;
      const err = Math.abs(d - 1000 / 60);
      if (err > 0.01) badT++;
      if (err > maxErr) maxErr = err;
    }
    out.integer_step_audit = {
      frames: audit.length, frame_increment_violations: badF,
      t_ms_delta_violations: badT, max_t_ms_delta_error: +maxErr.toFixed(6),
      expected_delta_ms: 1000 / 60,
    };

    out.catchup = { max_steps_per_raf: 5, note: 'RI-PLT01 R3 / HARNESS.md R3. Enforced in game/src/core/loop.js MAX_CATCHUP; observable in play mode only, and this container runs in harness mode where rAF never steps the sim.' };
    return out;
  }, FRAMES);
} finally {
  await handle.close();
}

// The four decoupling bodies are hashed host-side so the digest is computed the same way
// tools/lib/run.mjs computes body_sha256.
const hashes = report._bodies.map((b) => crypto.createHash('sha256').update(b).digest('hex'));
delete report._bodies;
report.decoupling.forEach((d, i) => { d.body_sha256 = hashes[i]; });
report.decoupling_identical = hashes.every((h) => h === hashes[0]);
report.page_errors = handle.errors;

writeJson(path.join(outDir, 'perf-probe.json'), report);
log(`renderer: ${report.renderer.unmaskedRenderer}`);
log(`Tier-H emitted: ${report.renderer.tierH_emitted} — ${report.renderer.tierH_reason}`);
for (const [k, v] of Object.entries(report.scene_budget)) log(`${k}: ${v.drawCalls_max} draw calls, ${v.triangles_max} tris, ${v.materials} materials, ${v.shadowLights} shadow lights, ${v.geometryMB} MB geometry`);
log(`sim CPU/step (render disabled), exterior: p50 ${report.sim_cpu_ms.F1_exterior.p50} ms, p99 ${report.sim_cpu_ms.F1_exterior.p99} ms, max ${report.sim_cpu_ms.F1_exterior.max} ms`);
log(`alloc/step exterior: ${report.alloc_per_step.F1_exterior.supported ? report.alloc_per_step.F1_exterior.bytes_per_step + ' B' : 'performance.memory unavailable'}`);
log(`decoupling: ${report.decoupling.map((d) => `${d.render_hz}Hz=${d.sim_steps} steps`).join(', ')} — hashes identical: ${report.decoupling_identical}`);
log(`integer-step audit: ${report.integer_step_audit.frame_increment_violations} frame violations, ${report.integer_step_audit.t_ms_delta_violations} t_ms violations, max error ${report.integer_step_audit.max_t_ms_delta_error} ms`);
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(path.join(outDir, 'perf-probe.json') + '\n');
process.exit(report.decoupling_identical && report.integer_step_audit.frame_increment_violations === 0 ? EXIT.OK : EXIT.MEASUREMENT_FAIL);
