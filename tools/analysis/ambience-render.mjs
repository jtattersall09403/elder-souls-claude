#!/usr/bin/env node
// RI-AUD03 — THE AUDIBILITY EVIDENCE. W1-22, `audio.ambience.region`.
//
// The whole reason this file exists rather than a bigger census: **an event count is not a
// sound.** A previous round measured `audioMB 0` while eight of nine audio axes were scored by
// reading identifier strings out of `regions.json`, and every one of those axes would have gone
// on scoring green against a build that made no noise at all. Audio is unusually easy to fake a
// green on, so the question this tool asks is deliberately the one a fake cannot answer:
//
//     *What does the waveform look like?*
//
// It launches ONE browser, drives the shipped engine, and for each of the thirteen regions:
//
//   W  the WORLD check. Teleport into the region, step the fixed loop, and read
//      `getAmbienceState()`. This proves the DRIVER — that `Engine._afterStep()` asked
//      `field.regionAt()` and the bed followed. Not the data: the running world.
//   R  the RENDER. `ambienceCapture()` renders the bed offline through the same graph builder
//      the live driver uses, and hands back real PCM.
//   M  the MEASUREMENT. Node-side: gated K-weighted loudness (BS.1770-4), spectral centroid,
//      and a 24-band log-spaced spectrum. Nothing here trusts a number the engine reported
//      about itself; every figure is computed from samples.
//
// then, across the thirteen:
//
//   S  PAIRWISE SEPARATION over all 78 unordered pairs, from the spectra. This is a MACHINE
//      proxy for RI-AUD03 B2, not B2 itself — B2 needs 78 fresh human/agent judges and is a
//      critic's to run. It is reported as `separation_proxy` and must never be quoted as B2.
//   C  THE CONTROL. Every L1 is replaced with one shared synth — RI-AUD03's own named failure,
//      "one swamp loop" — and everything is re-measured. If separation does not collapse, the
//      instrument is measuring nothing and its green is worthless.
//   B  A BORDER CROSSING. Walk the player across a real region boundary and require the bed to
//      change (RI-WLD12 M70).
//   E  AN EMITTER TRANSECT. 200 m past the bell buoy: pan and gain must vary monotonically with
//      bearing and distance (B6).
//   P  THE PERTURBATION (RI-MTH07). Move one L1 partial in the DATA, re-render, and require the
//      measured spectrum to move. This is the consumption demonstration: a bed nothing reads
//      would render identically.
//
//   node tools/analysis/ambience-render.mjs [--seconds 6] [--out reports/...json] [--json]

import { writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const USAGE = `
ambience-render.mjs — render the thirteen regional beds to PCM and measure them.

USAGE
  node tools/analysis/ambience-render.mjs [--seconds <n>] [--rate <hz>] [--out <file>] [--json]

Exit 0 = every gate passed. 1 = a gate failed. 2 = the build could not be driven.
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const SECONDS = Number(args.seconds || 6);
const RATE = Number(args.rate || 16000);

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const regions = JSON.parse(readFileSync(join(ROOT, 'game/data/world/regions.json'), 'utf8')).regions;

// ---- DSP, Node side -------------------------------------------------------------------------
// Everything below operates on samples the browser handed back. None of it asks the engine what
// it thinks it played.

/** In-place iterative radix-2 FFT. `re`/`im` are Float64Array of length 2^k. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

const NBANDS = 24;
const FMIN = 40, FMAX = 8000;

/**
 * Average magnitude spectrum over Hann-windowed 2048-sample frames, folded into 24 log-spaced
 * bands and normalised to unit sum. Normalisation is deliberate: it strips LEVEL out of the
 * comparison, so two regions cannot be called "different" merely because one is louder. That is
 * the mistake RI-AUD03 §C guards against by normalising the blind clips to −23 LUFS, and the
 * machine proxy has to make it too or it measures the volume knob.
 */
function bandSpectrum(x, sampleRate) {
  const N = 2048;
  const bands = new Float64Array(NBANDS);
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  const edges = [];
  for (let b = 0; b <= NBANDS; b++) edges.push(FMIN * Math.pow(FMAX / FMIN, b / NBANDS));
  let frames = 0;
  for (let off = 0; off + N <= x.length; off += N) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[off + i] * win[i];
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = k * sampleRate / N;
      if (f < FMIN || f >= FMAX) continue;
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      let b = Math.floor(NBANDS * Math.log(f / FMIN) / Math.log(FMAX / FMIN));
      if (b < 0) b = 0; if (b >= NBANDS) b = NBANDS - 1;
      bands[b] += mag;
    }
    frames++;
  }
  if (!frames) return { bands: Array.from(bands), centroid_hz: 0, frames: 0 };
  let total = 0;
  for (let b = 0; b < NBANDS; b++) total += bands[b];
  let cent = 0;
  if (total > 0) {
    for (let b = 0; b < NBANDS; b++) {
      const fc = Math.sqrt(edges[b] * edges[b + 1]);
      cent += fc * bands[b] / total;
      bands[b] /= total;
    }
  }
  return { bands: Array.from(bands), centroid_hz: cent, frames };
}

/** Cosine distance between two normalised band spectra, in [0, 1]. */
function specDistance(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 1;
  return 1 - dot / Math.sqrt(na * nb);
}

/**
 * ITU-R BS.1770-4 gated loudness, K-weighted. The two-stage K filter (a high-shelf and a
 * high-pass), 400 ms blocks with 75% overlap, absolute gate at −70 LUFS then a relative gate
 * 10 LU below the ungated mean. Coefficients are the standard's, retuned to the actual sample
 * rate by bilinear-transform frequency warping so a 16 kHz render is not measured with 48 kHz
 * coefficients — which would put the shelf in the wrong place and make every level wrong by a
 * consistent amount that looks like a design choice.
 */
function lufsIntegrated(x, fs) {
  const kw = kFilter(x, fs);
  const block = Math.round(0.4 * fs), hop = Math.round(0.1 * fs);
  const loud = [];
  for (let off = 0; off + block <= kw.length; off += hop) {
    let s = 0;
    for (let i = 0; i < block; i++) s += kw[off + i] * kw[off + i];
    const ms = s / block;
    loud.push(ms > 0 ? -0.691 + 10 * Math.log10(ms) : -Infinity);
  }
  const abs = loud.filter((l) => l > -70);
  if (!abs.length) return -Infinity;
  const meanPow = (arr) => arr.reduce((a, l) => a + Math.pow(10, (l + 0.691) / 10), 0) / arr.length;
  const ungated = -0.691 + 10 * Math.log10(meanPow(abs));
  const rel = abs.filter((l) => l > ungated - 10);
  if (!rel.length) return ungated;
  return -0.691 + 10 * Math.log10(meanPow(rel));
}

function kFilter(x, fs) {
  // Stage 1: high shelf, +4 dB at ~1681 Hz. Stage 2: high pass at ~38 Hz.
  const y1 = biquadShelf(x, fs, 1681.97, 4.0, 1 / Math.sqrt(2));
  return biquadHP(y1, fs, 38.13, 0.5);
}
function biquadShelf(x, fs, f0, gainDb, q) {
  const A = Math.pow(10, gainDb / 40), w = 2 * Math.PI * f0 / fs;
  const cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
  const b0 = A * ((A + 1) + (A - 1) * cw + 2 * Math.sqrt(A) * al);
  const b1 = -2 * A * ((A - 1) + (A + 1) * cw);
  const b2 = A * ((A + 1) + (A - 1) * cw - 2 * Math.sqrt(A) * al);
  const a0 = (A + 1) - (A - 1) * cw + 2 * Math.sqrt(A) * al;
  const a1 = 2 * ((A - 1) - (A + 1) * cw);
  const a2 = (A + 1) - (A - 1) * cw - 2 * Math.sqrt(A) * al;
  return runBiquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}
function biquadHP(x, fs, f0, q) {
  const w = 2 * Math.PI * f0 / fs, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
  const b0 = (1 + cw) / 2, b1 = -(1 + cw), b2 = (1 + cw) / 2;
  const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
  return runBiquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}
function runBiquad(x, b0, b1, b2, a1, a2) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/**
 * Mono sum of a capture. Accepts either the plain-array form or the base64 16-bit interleaved
 * form the engine returns by default — see `Engine.ambienceCapture()` for why the compact form
 * exists. Decoding happens here, in Node, on samples the browser produced; nothing in this path
 * asks the engine to summarise itself.
 */
function mono(cap) {
  if (cap.pcm16_interleaved_b64) {
    const raw = Buffer.from(cap.pcm16_interleaved_b64, 'base64');
    const n = raw.length >> 2;                       // 2 channels x 2 bytes
    const m = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const l = raw.readInt16LE(i * 4) / 32767, r = raw.readInt16LE(i * 4 + 2) / 32767;
      m[i] = 0.5 * (l + r);
    }
    return m;
  }
  const n = cap.L.length;
  const m = new Float64Array(n);
  for (let i = 0; i < n; i++) m[i] = 0.5 * (cap.L[i] + cap.R[i]);
  return m;
}
function peak(a) { let p = 0; for (let i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i])); return p; }

// ---- drive the build ---------------------------------------------------------------------------
const out = { tool: 'tools/analysis/ambience-render.mjs', seconds: SECONDS, sample_rate: RATE, gates: {}, regions: {}, notes: [] };
let handle;
let exitCode = 0;

try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
  const up = await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 }).then(() => true).catch(() => false);
  if (!up) { console.error('ambience-render: the game did not boot.'); process.exit(2); }

  // Rendering off for everything except nothing — we take no screenshots. AGENT-PROTOCOL:
  // a stepping loop that renders is the single most expensive thing in this project.
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));

  const surfaces = await page.evaluate(() => ['getAmbienceState', 'ambienceCapture', 'ambienceLog', 'ambienceEmitters']
    .map((k) => [k, typeof window.__HARNESS[k]]));
  out.harness_surfaces = Object.fromEntries(surfaces);
  if (surfaces.some(([, t]) => t !== 'function')) {
    console.error('ambience-render: harness surfaces missing:', JSON.stringify(out.harness_surfaces));
    process.exit(2);
  }

  // ---- W + R + M ------------------------------------------------------------------------------
  for (const r of regions) {
    const world = await page.evaluate(async ({ x, z }) => {
      const H = window.__HARNESS;
      H.setTimeOfDay(13);
      H.teleport(x, z, {});
      H.stepFrames(120);
      const s = H.getAmbienceState();
      return { region: s.region, layers: s.layers, denies: s.denies, voices_peak: s.voices_peak,
               over_cap: s.over_cap, events: s.events, context: s.context, suppressed: s.suppressed,
               crossfade: s.crossfade, target: s.bed_lufs_target };
    }, { x: r.centroid_m[0], z: r.centroid_m[1] });

    const cap = await page.evaluate(async ({ id, seconds, rate }) =>
      window.__HARNESS.ambienceCapture({ region: id, seconds, sampleRate: rate, tod: 'day' }),
    { id: r.id, seconds: SECONDS, rate: RATE });

    if (!cap || !cap.ok) {
      out.regions[r.id] = { world, capture: cap || { ok: false }, error: 'capture failed' };
      exitCode = 1;
      continue;
    }
    const m = mono(cap);
    const spec = bandSpectrum(m, cap.sampleRate);
    out.regions[r.id] = {
      world_region_from_field: world.region,
      driver_followed: world.region === r.id,
      layers: world.layers,
      voices_peak: world.voices_peak,
      over_voice_cap: world.over_cap,
      samples: m.length,
      peak: +peak(m).toFixed(5),
      silent: peak(m) < 1e-4,
      lufs_i: +lufsIntegrated(m, cap.sampleRate).toFixed(2),
      lufs_target: cap.bed_lufs_target,
      // The trim ALREADY in the data. `--calibrate` computes `target - measured + this`, so a
      // second calibration pass converges instead of oscillating around the first one's answer.
      bed_gain_db_before: cap.bed_gain_db || 0,
      centroid_hz: +spec.centroid_hz.toFixed(1),
      events_fired: cap.fired.length,
      key: cap.key,
      _bands: spec.bands,
    };
  }

  const ids = regions.map((r) => r.id).filter((id) => out.regions[id] && out.regions[id]._bands);

  // GATE 1 — the driver followed the world into every region.
  const followed = ids.filter((id) => out.regions[id].driver_followed);
  out.gates.G1_driver_followed = { pass: followed.length === regions.length, value: `${followed.length}/${regions.length}`,
    what: 'Engine._afterStep() -> field.regionAt() -> AmbienceDriver picked up the region the player stands in' };

  // GATE 2 — every region makes a sound. This is the one that could not have passed yesterday.
  const audible = ids.filter((id) => !out.regions[id].silent);
  out.gates.G2_audible = { pass: audible.length === regions.length, value: `${audible.length}/${regions.length}`,
    what: 'peak sample amplitude > 1e-4 in the rendered PCM. Not an event count: a waveform.' };

  // GATE 3 — thirteen different sounds (the machine proxy for B2).
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push({ a: ids[i], b: ids[j], d: +specDistance(out.regions[ids[i]]._bands, out.regions[ids[j]]._bands).toFixed(4) });
    }
  }
  pairs.sort((p, q) => p.d - q.d);
  const SEP = 0.15;
  const sep = pairs.filter((p) => p.d >= SEP).length / pairs.length;
  out.pairs_total = pairs.length;
  out.closest_pairs = pairs.slice(0, 5);
  out.gates.G3_separation_proxy = { pass: sep >= 0.80, value: +sep.toFixed(3), threshold: 0.80,
    what: `fraction of the ${pairs.length} unordered region pairs whose LEVEL-NORMALISED 24-band spectra differ by cosine distance >= ${SEP}`,
    caveat: 'A MACHINE PROXY FOR RI-AUD03 B2, NOT B2. B2 is 78 fresh judges answering SAME/DIFFERENT and is a critic\'s to run. Never quote this number as B2.' };

  // ---- --calibrate: write the per-bed master trim -----------------------------------------------
  // Not a threshold being loosened — a mix being made. The first render measured beds from −14.5
  // to −36.7 LUFS against targets of −24 to −34; every individual gain in the data was plausible
  // and their sum was not, because loudness is not the sum of the numbers you typed. This
  // computes the trim that lands each bed on its OWN declared target, applies it in the page,
  // re-renders to confirm, and writes it into the bed files.
  if (args.calibrate) {
    const trims = {};
    for (const id of ids) trims[id] = +(out.regions[id].lufs_target - out.regions[id].lufs_i
                                        + (out.regions[id].bed_gain_db_before || 0)).toFixed(2);
    const dir = join(ROOT, 'game/data/audio/ambience');
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const p = join(dir, f);
      const doc = JSON.parse(readFileSync(p, 'utf8'));
      if (trims[doc.id] === undefined) continue;
      doc.bed_gain_db = trims[doc.id];
      doc.bed_gain_db_note = 'Master trim, in dB, that lands this bed on its own bed_lufs_target. '
        + 'Calibrated by measurement (tools/analysis/ambience-render.mjs --calibrate), not guessed. '
        + 'Once written it is a regression fence: change a layer gain and the next render shows the '
        + 'bed off target. The run that writes it and re-measures it is self-fulfilling and proves '
        + 'nothing on its own; the value is in every later run.';
      writeFileSync(p, JSON.stringify(doc, null, 2) + '\n');
    }
    out.calibration_written = trims;
    // Re-render in-page with the trims applied, so this run reports post-calibration numbers.
    const re = await page.evaluate(async ({ trims, seconds, rate }) => {
      const E = window.__ENGINE;
      const res = {};
      for (const [id, t] of Object.entries(trims)) {
        E.ambience.beds[id].bed_gain_db = t;
        const c = await E.ambienceCapture({ region: id, seconds, sampleRate: rate, tod: 'day' });
        res[id] = c.ok ? { pcm16_interleaved_b64: c.pcm16_interleaved_b64, sampleRate: c.sampleRate } : null;
      }
      return res;
    }, { trims, seconds: SECONDS, rate: RATE });
    for (const [id, c] of Object.entries(re)) {
      if (!c) continue;
      const m = mono(c);
      out.regions[id].lufs_i_before_trim = out.regions[id].lufs_i;
      out.regions[id].bed_gain_db = trims[id];
      out.regions[id].lufs_i = +lufsIntegrated(m, c.sampleRate).toFixed(2);
      out.regions[id].peak = +peak(m).toFixed(5);
      out.regions[id]._bands = bandSpectrum(m, c.sampleRate).bands;
    }
  }

  // GATE 4 — bed level inside §A's band (B5's own check, on real loudness).
  const inBand = ids.filter((id) => {
    const r = out.regions[id], t = r.lufs_target;
    return r.lufs_i >= t - 4 && r.lufs_i <= t + 4;
  });
  out.gates.G4_level = { pass: inBand.length >= 11, value: `${inBand.length}/${ids.length}`, threshold: '>=11',
    what: 'gated K-weighted LUFS-I within +/-4 LU of the bed\'s declared target',
    caveat: 'The +/-4 LU tolerance is W1-22\'s, not RI-AUD03\'s. B5 asks for absolute -28..-24; that is a MIX calibration against a real output chain, and this build has no master bus, no combat audio to leave headroom for, and no monitoring. Reporting a calibrated absolute figure here would be inventing a mix. What is checked instead is that each bed lands where its own data says it should — which is the part that is knowable today.' };

  // ---- C: THE CONTROL -------------------------------------------------------------------------
  // RI-AUD03's own first-named failure: one swamp loop. Replace every L1 with a single shared
  // synth, re-render, re-measure. If G3 does not collapse, G3 is not measuring what it claims.
  const ctlSpecs = await page.evaluate(async ({ seconds, rate }) => {
    const E = window.__ENGINE;
    const beds = E.ambience.beds;
    const ids = Object.keys(beds);
    const shared = JSON.parse(JSON.stringify(beds[ids[0]].layers.L1));
    shared.id = 'swamp_amb_loop';
    const saved = {};
    for (const id of ids) { saved[id] = beds[id].layers.L1; beds[id].layers.L1 = JSON.parse(JSON.stringify(shared)); }
    const caps = {};
    for (const id of ids) {
      const c = await E.ambienceCapture({ region: id, seconds, sampleRate: rate, tod: 'day' });
      caps[id] = c.ok ? { pcm16_interleaved_b64: c.pcm16_interleaved_b64, sampleRate: c.sampleRate } : null;
    }
    for (const id of ids) beds[id].layers.L1 = saved[id];
    return caps;
  }, { seconds: SECONDS, rate: RATE });

  const ctlBands = {};
  for (const [id, c] of Object.entries(ctlSpecs)) {
    if (!c) continue;
    ctlBands[id] = bandSpectrum(mono(c), c.sampleRate).bands;
  }
  const cIds = Object.keys(ctlBands);
  let cPairs = 0, cSep = 0;
  for (let i = 0; i < cIds.length; i++) {
    for (let j = i + 1; j < cIds.length; j++) {
      cPairs++;
      if (specDistance(ctlBands[cIds[i]], ctlBands[cIds[j]]) >= SEP) cSep++;
    }
  }
  const ctlSep = cPairs ? cSep / cPairs : 1;
  out.control_one_swamp_loop = { separation_proxy: +ctlSep.toFixed(3), pairs: cPairs };
  out.gates.G5_control_collapses = { pass: ctlSep < sep - 0.15, value: +ctlSep.toFixed(3),
    what: 'with every L1 forced to one shared asset, separation must COLLAPSE. If it does not, G3 is not measuring region identity and its green means nothing.',
    live_value: +sep.toFixed(3) };

  // ---- B: a real border crossing --------------------------------------------------------------
  const border = await page.evaluate(async () => {
    const H = window.__HARNESS, E = window.__ENGINE, f = E.field;
    // Find a genuine boundary by sampling along a line between two region centroids.
    const A = E.data.regions.regions.find((r) => r.id === 'stone-forest');
    const B = E.data.regions.regions.find((r) => r.id === 'valus-ridge');
    if (!A || !B) return { ok: false, why: 'regions missing' };
    let cross = null;
    const steps = 400;
    for (let i = 1; i <= steps; i++) {
      const t0 = (i - 1) / steps, t1 = i / steps;
      const p0 = [A.centroid_m[0] + (B.centroid_m[0] - A.centroid_m[0]) * t0, A.centroid_m[1] + (B.centroid_m[1] - A.centroid_m[1]) * t0];
      const p1 = [A.centroid_m[0] + (B.centroid_m[0] - A.centroid_m[0]) * t1, A.centroid_m[1] + (B.centroid_m[1] - A.centroid_m[1]) * t1];
      const r0 = f.regionAt(p0[0], p0[1]), r1 = f.regionAt(p1[0], p1[1]);
      if (r0 && r1 && r0.id !== r1.id) { cross = { p0, p1, from: r0.id, to: r1.id }; break; }
    }
    if (!cross) return { ok: false, why: 'no boundary found on the transect' };
    H.teleport(cross.p0[0], cross.p0[1], {});
    H.stepFrames(60);
    const before = H.getAmbienceState();
    H.teleport(cross.p1[0], cross.p1[1], {});
    H.stepFrames(1);
    const after = H.getAmbienceState();
    const log = H.ambienceLog(40).filter((e) => e.type === 'region_change');
    return { ok: true, cross, before: { region: before.region, L1: before.layers && before.layers.L1, crossfade: before.crossfade },
             after: { region: after.region, L1: after.layers && after.layers.L1, crossfade: after.crossfade },
             region_change_events: log.length, last_event: log[log.length - 1] || null };
  });
  out.border_crossing = border;
  out.gates.G6_border = {
    pass: !!(border.ok && border.before.region !== border.after.region && border.before.L1 !== border.after.L1
             && border.after.crossfade < 1),
    what: 'RI-WLD12 M70: the bed changes at a border. Requires a DIFFERENT L1 on the far side and a crossfade in progress, not merely a different region name.',
  };

  // ---- E: the emitter transect (B6) ------------------------------------------------------------
  const transect = await page.evaluate(() => {
    const H = window.__HARNESS;
    // Walk east past the bell buoy at (398, 4486), facing north, OFFSET 150 m to the south.
    //
    // The offset is load-bearing and the first version of this probe did not have it. Walking
    // along z = 4486 puts the buoy exactly abeam for the whole transect, so `sin(bearing)`
    // saturates at +1, flips to −1 at the moment of passing, and saturates again — a plateau,
    // a step, a plateau. The pan model was correct and the PROBE was degenerate. Offsetting the
    // line makes the bearing sweep continuously, which is the case a player actually walks and
    // the only one in which "moves across the stereo field" is a testable claim at all.
    const rows = [];
    for (let d = -300; d <= 300; d += 20) {
      const r = H.ambienceEmitters(398 + d, 4486 - 150, 0, 'marauders-coast');
      const e = r.emitters.find((x) => x.id === 'bell_buoy');
      rows.push({ x: 398 + d, distance_m: e ? +e.distance_m.toFixed(1) : null,
                  pan: e ? +e.pan.toFixed(4) : null, gain: e ? +e.gain.toFixed(4) : null, audible: e ? e.audible : false });
    }
    // And a turn on the spot 200 m west: the bell must sweep across the stereo field.
    const turn = [];
    for (let yaw = 0; yaw < 360; yaw += 45) {
      const r = H.ambienceEmitters(198, 4486, yaw, 'marauders-coast');
      const e = r.emitters.find((x) => x.id === 'bell_buoy');
      turn.push({ yaw, pan: e ? +e.pan.toFixed(3) : null });
    }
    // Out of range: 800 m away, beyond the 600 m cutoff.
    const far = H.ambienceEmitters(398 - 800, 4486, 0, 'marauders-coast').emitters.find((x) => x.id === 'bell_buoy');
    return { rows, turn, far_audible: far ? far.audible : null };
  });
  out.emitter_transect = transect;
  {
    const rows = transect.rows.filter((r) => r.audible);
    // STRICT monotonicity, in whichever direction the geometry dictates, with no plateau: a
    // plateau means the bearing has saturated and the bell has stopped carrying position. Plus
    // exactly one zero crossing (it passes you once), and a gain maximum at closest approach.
    let mono = rows.length > 4;
    const dir = Math.sign(rows[rows.length - 1].pan - rows[0].pan);
    for (let i = 1; i < rows.length; i++) {
      if (Math.sign(rows[i].pan - rows[i - 1].pan) !== dir) { mono = false; break; }
    }
    // Count the crossing, not the arithmetic. The first version compared `Math.sign()` of
    // consecutive pans, and the transect happens to sample the buoy at exactly abeam — pan 0.
    // `sign` goes +1 → 0 → −1, which is two sign changes and one crossing, so a textbook-perfect
    // sweep (+0.894 through 0 to −0.894, strictly monotonic, gain peaking at closest approach)
    // was reported as a failure. A strict sign product plus an exact-zero count is the honest
    // form. This is the second time in this piece that the probe was wrong and the model was
    // right, which is worth leaving on the record next to the check itself.
    let crossings = 0;
    for (let i = 1; i < rows.length; i++) if (rows[i - 1].pan * rows[i].pan < 0) crossings++;
    crossings += rows.filter((r) => r.pan === 0).length;
    const gains = rows.map((r) => r.gain);
    const gMaxAt = gains.indexOf(Math.max(...gains));
    const nearestAt = rows.map((r) => r.distance_m).indexOf(Math.min(...rows.map((r) => r.distance_m)));
    const gainsRise = Math.max(...gains) > 2 * Math.min(...gains) && gMaxAt === nearestAt;
    const sweeps = new Set(transect.turn.map((t) => Math.sign(t.pan))).size >= 2;
    out.gates.G7_emitter = { pass: mono && crossings === 1 && gainsRise && sweeps && transect.far_audible === false,
      pan_strictly_monotonic: mono, zero_crossings: crossings, gain_peaks_at_closest_approach: gainsRise,
      pan_sweeps_when_the_player_turns: sweeps, silent_beyond_audible_m: transect.far_audible === false,
      what: 'RI-AUD03 B6 / R7. A landmark you can steer by must move across the stereo field as you pass it AND as you turn your head, must be loudest where it is nearest, and must stop at its stated range.' };
  }

  // ---- P: THE PERTURBATION (RI-MTH07) ----------------------------------------------------------
  // Move ONE number in ONE bed and require the rendered spectrum to move. A bed that nothing
  // reads renders identically no matter what the data says — which is the exact defect
  // fourteen subsystems in this build have shipped.
  const perturb = await page.evaluate(async ({ seconds, rate }) => {
    const E = window.__ENGINE;
    const bed = E.ambience.beds['valus-ridge'];
    const before = await E.ambienceCapture({ region: 'valus-ridge', seconds, sampleRate: rate, tod: 'day' });
    const saved = JSON.parse(JSON.stringify(bed.layers.L1.synth.partials_hz));
    bed.layers.L1.synth.partials_hz = saved.map((f) => f * 3);   // up an octave and a fifth
    const after = await E.ambienceCapture({ region: 'valus-ridge', seconds, sampleRate: rate, tod: 'day' });
    bed.layers.L1.synth.partials_hz = saved;
    const restored = await E.ambienceCapture({ region: 'valus-ridge', seconds, sampleRate: rate, tod: 'day' });
    return {
      before: { pcm16_interleaved_b64: before.pcm16_interleaved_b64, sampleRate: before.sampleRate },
      after: { pcm16_interleaved_b64: after.pcm16_interleaved_b64, sampleRate: after.sampleRate },
      restored: { pcm16_interleaved_b64: restored.pcm16_interleaved_b64, sampleRate: restored.sampleRate },
      from: saved, to: saved.map((f) => f * 3),
    };
  }, { seconds: SECONDS, rate: RATE });

  const pm = mono;
  const sBefore = bandSpectrum(pm(perturb.before), perturb.before.sampleRate);
  const sAfter = bandSpectrum(pm(perturb.after), perturb.after.sampleRate);
  const sRestored = bandSpectrum(pm(perturb.restored), perturb.restored.sampleRate);
  out.perturbation = {
    region: 'valus-ridge', layer: 'L1', field: 'synth.partials_hz',
    from_hz: perturb.from, to_hz: perturb.to,
    centroid_before_hz: +sBefore.centroid_hz.toFixed(1),
    centroid_after_hz: +sAfter.centroid_hz.toFixed(1),
    centroid_restored_hz: +sRestored.centroid_hz.toFixed(1),
    spectral_distance_before_after: +specDistance(sBefore.bands, sAfter.bands).toFixed(4),
    spectral_distance_before_restored: +specDistance(sBefore.bands, sRestored.bands).toFixed(6),
  };
  out.gates.G8_consumption = {
    pass: out.perturbation.spectral_distance_before_after > 0.05
          && out.perturbation.spectral_distance_before_restored < 1e-6,
    what: 'RI-MTH07. Tripling one L1\'s partials must move the rendered spectrum, and restoring them must return it EXACTLY. The second half is what rules out a coincidence: a render that is not a function of the data cannot come back to the same place.',
  };

  // ---- G9: THE LIVE PATH, EXERCISED ---------------------------------------------------------
  // Everything above measures the OFFLINE render. The code a player actually hears is
  // `AmbienceDriver.attach()` → `_swapLive()` → `buildBedContinuous`, and automated runs never
  // reach it (`main.js` only attaches on a real gesture, and `--mute-audio` is in the
  // deterministic flag list). Untested code on the one path that reaches a person is exactly how
  // a subsystem ships correct and silent, so the live path is driven here against an
  // `OfflineAudioContext` — same `BaseAudioContext` interface, no sound card required.
  const liveCheck = await page.evaluate(async () => {
    const E = window.__ENGINE, H = window.__HARNESS;
    const ctx = new OfflineAudioContext(2, 48000, 24000);
    try {
      E.ambience.attach(ctx);
      const afterAttach = E.ambience.live ? E.ambience.live.layers.length : 0;
      // Cross a border with the context attached: `_swapLive` must run without throwing and
      // must replace the layer set.
      const f = E.field;
      const A = E.data.regions.regions.find((r) => r.id === 'stone-forest');
      const B = E.data.regions.regions.find((r) => r.id === 'valus-ridge');
      let moved = null;
      for (let i = 1; i <= 400; i++) {
        const t = i / 400;
        const x = A.centroid_m[0] + (B.centroid_m[0] - A.centroid_m[0]) * t;
        const z = A.centroid_m[1] + (B.centroid_m[1] - A.centroid_m[1]) * t;
        if (f.regionAt(x, z).id !== E.ambience.region) { moved = [x, z]; break; }
      }
      if (moved) { H.teleport(moved[0], moved[1], {}); H.stepFrames(30); }
      const afterCross = E.ambience.live ? E.ambience.live.layers.length : 0;
      // Force a scheduled grain through the live path too, so buildGrain is exercised live.
      H.stepFrames(3600);
      const events = E.ambience.events;
      const rendered = await ctx.startRendering();
      let p = 0; const d = rendered.getChannelData(0);
      for (let i = 0; i < d.length; i++) p = Math.max(p, Math.abs(d[i]));
      E.ambience.detach();
      return { ok: true, layers_after_attach: afterAttach, layers_after_crossing: afterCross,
               events, live_peak: p, crossed: !!moved };
    } catch (e) { try { E.ambience.detach(); } catch { /* */ } return { ok: false, error: String(e).slice(0, 300) }; }
  });
  out.live_path = liveCheck;
  out.gates.G9_live_path = {
    pass: !!(liveCheck.ok && liveCheck.layers_after_attach > 0 && liveCheck.crossed
             && liveCheck.layers_after_crossing > 0 && liveCheck.live_peak > 1e-4),
    what: 'AmbienceDriver.attach() → _swapLive() → buildBedContinuous, driven from the fixed step across a real border, into a context that renders. This is the code a player hears; nothing else in this tool touches it.',
    value: liveCheck.ok ? `peak ${liveCheck.live_peak.toFixed(5)}, layers ${liveCheck.layers_after_attach}→${liveCheck.layers_after_crossing}` : liveCheck.error,
  };

  out.page_errors = pageErrors;
  const failed = Object.entries(out.gates).filter(([, g]) => !g.pass).map(([k]) => k);
  out.pass = failed.length === 0;
  out.failed_gates = failed;
  if (failed.length) exitCode = 1;
} catch (e) {
  out.error = String(e && e.stack || e).slice(0, 1200);
  exitCode = 2;
} finally {
  if (handle) await handle.close().catch(() => {});
}

// Drop the raw band arrays from the printed report; they are noise for a reader.
const printable = JSON.parse(JSON.stringify(out));
for (const r of Object.values(printable.regions || {})) delete r._bands;

if (args.out) {
  mkdirSync(dirname(join(ROOT, String(args.out))), { recursive: true });
  writeFileSync(join(ROOT, String(args.out)), JSON.stringify(printable, null, 2) + '\n');
}

// THE SPECTRA SIDECAR, for `tools/world/region-axes.mjs`.
//
// RI-WLD04 M18's own tool drops the `audio` axis, and its header says exactly why: "The audio
// axis is the sharpest illustration — getWorldStats() reports audioMB: 0. There is no audio in
// this build at all, and the audio axis still scores 78/78." That was the correct call against a
// build with no audio, and it is no longer the right one. This file is the measured input that
// lets that axis be scored off rendered sound instead of dropped — or off nothing, if this file
// is absent, in which case region-axes.mjs behaves exactly as it did before.
if (out.pass !== undefined && Object.keys(out.regions).length) {
  const spectra = { schema: 'elder-souls/ambience-spectra@1',
    source: 'tools/analysis/ambience-render.mjs — level-normalised 24-band spectra of the rendered PCM',
    seconds: SECONDS, sample_rate: RATE, bands: NBANDS, f_min_hz: FMIN, f_max_hz: FMAX, regions: {} };
  for (const [id, r] of Object.entries(out.regions)) {
    if (r._bands) spectra.regions[id] = { bands: r._bands.map((v) => +v.toFixed(6)), centroid_hz: r.centroid_hz, lufs_i: r.lufs_i };
  }
  mkdirSync(join(ROOT, 'reports/w1-22'), { recursive: true });
  writeFileSync(join(ROOT, 'reports/w1-22/ambience-spectra.json'), JSON.stringify(spectra, null, 2) + '\n');
}
if (args.json) console.log(JSON.stringify(printable, null, 2));
else {
  console.log(`ambience-render: ${SECONDS}s per region at ${RATE} Hz`);
  for (const [id, r] of Object.entries(printable.regions || {})) {
    console.log(`  ${id.padEnd(20)} peak ${String(r.peak).padStart(8)}  LUFS-I ${String(r.lufs_i).padStart(7)} (target ${r.lufs_target})  centroid ${String(r.centroid_hz).padStart(7)} Hz  events ${r.events_fired}  driver:${r.driver_followed ? 'ok' : 'MISSED'}`);
  }
  console.log('');
  for (const [k, g] of Object.entries(printable.gates || {})) {
    console.log(`  ${g.pass ? 'PASS' : 'FAIL'} ${k}  ${g.value !== undefined ? g.value : ''}`);
  }
  if (printable.error) console.log(`  ERROR ${printable.error}`);
  console.log(`  => ${printable.pass ? 'PASS' : 'FAIL'}${printable.failed_gates && printable.failed_gates.length ? ' (' + printable.failed_gates.join(', ') + ')' : ''}`);
}
process.exit(exitCode);
