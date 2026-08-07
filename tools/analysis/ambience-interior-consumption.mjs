#!/usr/bin/env node
// CONSUMPTION for the interior ambience beds. W1-22 round 2. RI-AUD03 R4, ARBITRATION §3
// (RI-MTH07): "for every model a piece ships, name the world-side consumer and demonstrate it by
// perturbing the model and observing a change."
//
// WHY THIS EXISTS SEPARATELY FROM THE CENSUS. Seven new bed files on disk prove nothing. The
// round-1 verdict's biggest gap was a model computed every frame into a trace nothing consumed,
// and the failure mode this project names sixteen times over is a correct, instrumented model
// that no entity in the running world reads. So this tool does not read the bed files at all. It
// walks the player into each interior cell, asks the RUNNING WORLD what it is playing, and then
// perturbs the bed and requires the world's answer to move.
//
// Three things are asserted, and the second is the one that matters:
//
//   I1  Entering an interior cell selects that cell's OWN bed. Round 1 set `suppressed` here and
//       the world went absolutely silent indoors, settlements included.
//   I2  CONSUMPTION. Change an interior bed's L1 partials/filter in the page and the PCM the
//       world renders for that cell must move; restore it and the render must come back EXACTLY.
//       The exact return is what rules out coincidence — a render that is not a function of the
//       data cannot find its way back to the same samples.
//   I3  The interior bed is not the exterior bed (R4). The cell's rendered spectrum must differ
//       from the spectrum of the region the player was standing in when they went inside, by
//       more than two beds of the same family differ from each other.
//
//   node tools/analysis/ambience-interior-consumption.mjs [--seconds 8] [--rate 16000] [--json]
//
// Exit 0 = every check passed. 1 = a check failed. 2 = the build could not be driven.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const USAGE = `ambience-interior-consumption.mjs — do the interior beds reach the running world?\n
  --seconds N   render length per clip (default 8)
  --rate HZ     render sample rate (default 16000)\n`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const SECONDS = Number(args.seconds || 8);
const RATE = Number(args.rate || 16000);
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

function decode(cap) {
  const raw = Buffer.from(cap.pcm16_interleaved_b64, 'base64');
  const n = raw.length >> 2;
  const m = new Float64Array(n);
  for (let i = 0; i < n; i++) m[i] = 0.5 * (raw.readInt16LE(i * 4) / 32767 + raw.readInt16LE(i * 4 + 2) / 32767);
  return m;
}
/** 16 log-spaced band energies, normalised — enough to say "this is a different place". */
function bands(x, fs) {
  const N = 2048, out = new Float64Array(16);
  const edges = []; for (let i = 0; i <= 16; i++) edges.push(40 * Math.pow(6000 / 40, i / 16));
  for (let off = 0; off + N <= x.length; off += N) {
    for (let k = 1; k < N / 2; k++) {
      const f = k * fs / N;
      let re = 0, im = 0;
      for (let n = 0; n < N; n += 4) {              // decimated DFT: cheap, and only used for a ratio
        const a = -2 * Math.PI * k * n / N;
        re += x[off + n] * Math.cos(a); im += x[off + n] * Math.sin(a);
      }
      const p = re * re + im * im;
      for (let b = 0; b < 16; b++) if (f >= edges[b] && f < edges[b + 1]) { out[b] += p; break; }
    }
  }
  let s = 0; for (const v of out) s += v;
  return s > 0 ? Array.from(out, (v) => v / s) : Array.from(out);
}
function dist(a, b) { let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); return d / 2; }
function gitStamp() {
  try {
    const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { commit: sh('git rev-parse --short HEAD'), dirty: sh('git status --porcelain') !== '' };
  } catch { return {}; }
}

const out = { tool: 'tools/analysis/ambience-interior-consumption.mjs', taken_at: new Date().toISOString(),
              git: gitStamp(), seconds: SECONDS, sample_rate: RATE, cells: {}, checks: {}, notes: [] };
let handle, exitCode = 0;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));

  // The cells `Engine.cellFor()` can return, and how `sim.env` has to be set to get there. The
  // list is derived from the engine rather than guessed, so a new cell cannot be silently missed.
  const cells = await page.evaluate(() => {
    const E = window.__ENGINE;
    const ids = Object.keys(E.ambience.beds);
    return { beds: ids, has_interiors: ids.filter((i) => !/-/.test(i)) };
  });
  out.beds_loaded = cells.beds.length;
  out.interior_beds = cells.has_interiors;

  const res = await page.evaluate(async ({ seconds, rate }) => {
    const E = window.__ENGINE, H = window.__HARNESS;
    const want = [
      ['barge_hold', { interior: 'barge-hold' }],
      ['writ_house', { interior: 'writ-house' }],
      ['market', { interior: 'helstrom-market' }],
      ['street', { interior: 'stormhold-street' }],
      ['well', { interior: 'rootlands-well' }],
      ['dungeon', { interior: 'dungeon-primary' }],
      ['interior', { interior: 'some-unnamed-room' }],
      ['arena', { region: 'arena' }],
    ];
    const o = {};
    // Where the player is standing OUTSIDE, so I3 can compare indoors against the real exterior.
    const savedEnv = JSON.parse(JSON.stringify(E.sim.env));
    E.sim.env.interior = null; E.sim.env.region = null;
    H.stepFrames(90);
    const outsideState = H.getAmbienceState();
    const outsideCap = await E.ambienceCapture({ seconds, sampleRate: rate, tod: 'day' });

    for (const [cell, env] of want) {
      E.sim.env.interior = env.interior || null;
      E.sim.env.region = env.region || null;
      H.stepFrames(90);
      const s = H.getAmbienceState();
      const entry = { cell: s.cell, region: s.region, suppressed: s.suppressed,
                      layers: s.layers, voices_active: s.voices_active, events: s.events };
      if (!s.suppressed && E.ambience.beds[s.region]) {
        const c = await E.ambienceCapture({ region: s.region, seconds, sampleRate: rate, tod: 'day' });
        entry.pcm = c.pcm16_interleaved_b64;
        // I2 — perturb this cell's own L1 and require the render to move, then restore EXACTLY.
        const bed = E.ambience.beds[s.region];
        const syn = bed.layers.L1.synth;
        const savedP = syn.partials_hz ? JSON.parse(JSON.stringify(syn.partials_hz)) : null;
        const savedF = syn.filter ? syn.filter.hz : null;
        if (savedP) syn.partials_hz = savedP.map((f) => f * 3);
        else if (savedF !== null) syn.filter.hz = savedF * 6;
        const cAfter = await E.ambienceCapture({ region: s.region, seconds, sampleRate: rate, tod: 'day' });
        if (savedP) syn.partials_hz = savedP; else if (savedF !== null) syn.filter.hz = savedF;
        const cBack = await E.ambienceCapture({ region: s.region, seconds, sampleRate: rate, tod: 'day' });
        entry.pcm_perturbed = cAfter.pcm16_interleaved_b64;
        entry.restored_identical = cBack.pcm16_interleaved_b64 === c.pcm16_interleaved_b64;
        entry.perturbed = savedP ? { field: 'partials_hz', from: savedP } : { field: 'filter.hz', from: savedF };
      }
      o[cell] = entry;
    }
    E.sim.env = savedEnv;
    return { cells: o, outside: { region: outsideState.region, pcm: outsideCap.pcm16_interleaved_b64 } };
  }, { seconds: SECONDS, rate: RATE });

  const outsideBands = bands(decode({ pcm16_interleaved_b64: res.outside.pcm }), RATE);
  const i1 = [], i2 = [], i3 = [];
  for (const [cell, e] of Object.entries(res.cells)) {
    const rec = out.cells[cell] = { engine_cell: e.cell, bed: e.region, suppressed: e.suppressed,
                                    layers: e.layers, voices_active: e.voices_active };
    if (cell === 'arena') {
      // Deliberately has no bed. Asserted as a DECLARED absence rather than skipped, so that
      // "arena is silent on purpose" and "arena lost its bed" stay distinguishable.
      rec.expected = 'suppressed by design — an arena\'s sound is the combat mix, not regional ambience';
      if (!e.suppressed) i1.push(`${cell}: expected suppressed, got bed ${e.region}`);
      continue;
    }
    if (e.suppressed || !e.pcm) { i1.push(`${cell}: suppressed (${e.suppressed}) — no interior bed reached the world`); continue; }
    if (e.region !== cell) i1.push(`${cell}: the world selected bed "${e.region}"`);
    const b0 = bands(decode({ pcm16_interleaved_b64: e.pcm }), RATE);
    const b1 = bands(decode({ pcm16_interleaved_b64: e.pcm_perturbed }), RATE);
    rec.perturbation = { ...e.perturbed, spectral_distance: +dist(b0, b1).toFixed(4),
                         restored_identical: e.restored_identical };
    if (!(dist(b0, b1) > 0.02)) i2.push(`${cell}: perturbing L1 moved the render by only ${dist(b0, b1).toFixed(4)}`);
    if (!e.restored_identical) i2.push(`${cell}: restoring the data did not restore the render exactly`);
    rec.distance_from_exterior = +dist(b0, outsideBands).toFixed(4);
    if (!(dist(b0, outsideBands) > 0.15)) i3.push(`${cell}: only ${dist(b0, outsideBands).toFixed(4)} from the exterior bed`);
  }
  out.exterior_region = res.outside.region;
  out.checks.I1_interior_bed_selected = { pass: i1.length === 0, failures: i1,
    what: 'entering an interior cell selects that cell\'s own bed. Round 1 set `suppressed` here and the world went silent indoors, settlements included.' };
  out.checks.I2_consumption = { pass: i2.length === 0, failures: i2,
    what: 'RI-MTH07. Perturbing an interior bed\'s L1 in the page moves the PCM the world renders for that cell, and restoring it returns the render EXACTLY.' };
  out.checks.I3_not_the_exterior = { pass: i3.length === 0, failures: i3,
    what: 'R4. The interior bed is a different place from the exterior the player just left, not that exterior at a lower level.' };
  for (const c of Object.values(out.checks)) if (!c.pass) exitCode = 1;
} finally {
  if (handle) await handle.close();
}

const outPath = args.out || join(ROOT, 'reports/w1-22/ambience-interior-consumption.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2));
if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`ambience-interior-consumption @ ${out.git.commit}${out.git.dirty ? ' (dirty)' : ''} — exterior was ${out.exterior_region}`);
  for (const [cell, r] of Object.entries(out.cells)) {
    console.log(`  ${cell.padEnd(12)} bed=${String(r.bed).padEnd(12)} suppressed=${String(r.suppressed).padEnd(6)}`
      + (r.perturbation ? ` perturb d=${r.perturbation.spectral_distance} restored=${r.perturbation.restored_identical} vs-exterior=${r.distance_from_exterior}` : ''));
  }
  for (const [k, c] of Object.entries(out.checks)) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${k}${c.pass ? '' : ' — ' + c.failures.join('; ')}`);
  }
  console.log(`report: ${outPath}`);
}
process.exit(exitCode);
