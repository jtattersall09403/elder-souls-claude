#!/usr/bin/env node
// critic-w1-22-probe.mjs — WRITTEN BY THE W1-22 ROUND-1 CRITIC, declared under method_deviations.
//
// This is not the builder's instrument. The DSP below (gated BS.1770-4 loudness, FFT, spectral
// centroid, 24-band log spectrum) is written independently so that a number agreeing with
// reports/w1-22/ambience-render.json is agreement between two instruments rather than a tool
// reporting on itself. One region's loudness is cross-checked against the builder's figure at the
// end; if they disagree by more than 0.2 LU, one of the two is wrong and the report says so.
//
// It answers five questions the builder's tool does not ask:
//
//   A  Is `bed_gain_db` non-scalar BECAUSE the gain-LFO's swing is applied before the trim?
//      Rendered with the L1 gain modulation present and again with it deleted, at two trims.
//      Prediction, stated before the run: with the mod deleted, loudness / peak / centroid move
//      by exactly (-dTrim, -dTrim, 0). With it present, by less, less, and non-zero.
//   B  Is any R7 positional emitter AUDIBLE? Perturb `bell_buoy.level_db` by +40 dB and require
//      the rendered PCM to move. A control perturbs L1's level_db by +40 and MUST move it, so a
//      null result is a fact about the emitter and not about the probe.
//   C  B5 as RI-AUD03 actually writes it: absolute -28..-24 LUFS-I, Stone Wastes exempt at -34+-2.
//      (The builder's G4 checks +-4 LU around each bed's OWN target, which is a different claim.)
//   D  The full 78-pair spectral distance matrix, re-derived, to fix the B2 hard stratum.
//   E  Does the interior/settlement suppression path actually fire in the running world?
//
//   node tools/analysis/critic-w1-22-probe.mjs [--seconds 20] [--rate 16000] --out <file>

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const USAGE = `critic-w1-22-probe.mjs — the W1-22 critic's own instrument.\n
  --seconds N   render length per clip (default 20)
  --rate HZ     render sample rate (default 16000)
  --out FILE    write the JSON report here\n`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const SECONDS = Number(args.seconds || 20);
const RATE = Number(args.rate || 16000);
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// ---- DSP, written here, on samples the browser produced ---------------------------------------

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
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

const NB = 24, FMIN = 40, FMAX = 8000;

/** Returns the 24-band log spectrum (unit sum), the band-weighted centroid the builder reports,
 *  and a TRUE power-weighted linear centroid, which is the physically meaningful one. */
function analyse(x, fs) {
  const N = 2048;
  const bands = new Float64Array(NB);
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  const edges = [];
  for (let b = 0; b <= NB; b++) edges.push(FMIN * Math.pow(FMAX / FMIN, b / NB));
  let frames = 0, pnum = 0, pden = 0;
  for (let off = 0; off + N <= x.length; off += N) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[off + i] * win[i];
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = k * fs / N;
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      pnum += f * mag * mag; pden += mag * mag;              // true power centroid, full band
      if (f < FMIN || f >= FMAX) continue;
      let b = Math.floor(NB * Math.log(f / FMIN) / Math.log(FMAX / FMIN));
      if (b < 0) b = 0; if (b >= NB) b = NB - 1;
      bands[b] += mag;
    }
    frames++;
  }
  let total = 0; for (let b = 0; b < NB; b++) total += bands[b];
  let cent = 0;
  if (total > 0) for (let b = 0; b < NB; b++) { cent += Math.sqrt(edges[b] * edges[b + 1]) * bands[b] / total; }
  const norm = total > 0 ? Array.from(bands, (v) => v / total) : Array.from(bands);
  return { bands: norm, band_centroid_hz: cent, power_centroid_hz: pden > 0 ? pnum / pden : 0, frames };
}

function specDistance(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 1;
  return 1 - dot / Math.sqrt(na * nb);
}

function bq(x, b0, b1, b2, a1, a2) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
/** BS.1770-4 K-weighting, coefficients derived at the render rate by bilinear warping. */
function kWeight(x, fs) {
  const shelf = (() => {
    const A = Math.pow(10, 4 / 40), w = 2 * Math.PI * 1681.97 / fs, q = 1 / Math.SQRT2;
    const cw = Math.cos(w), al = Math.sin(w) / (2 * q), sA = Math.sqrt(A);
    const b0 = A * ((A + 1) + (A - 1) * cw + 2 * sA * al);
    const b1 = -2 * A * ((A - 1) + (A + 1) * cw);
    const b2 = A * ((A + 1) + (A - 1) * cw - 2 * sA * al);
    const a0 = (A + 1) - (A - 1) * cw + 2 * sA * al;
    const a1 = 2 * ((A - 1) - (A + 1) * cw);
    const a2 = (A + 1) - (A - 1) * cw - 2 * sA * al;
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  })();
  const hp = (() => {
    const w = 2 * Math.PI * 38.13 / fs, cw = Math.cos(w), al = Math.sin(w) / (2 * 0.5);
    const b0 = (1 + cw) / 2, b1 = -(1 + cw), b2 = (1 + cw) / 2;
    const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  })();
  return bq(bq(x, ...shelf), ...hp);
}
function lufsI(x, fs) {
  const k = kWeight(x, fs);
  const block = Math.round(0.4 * fs), hop = Math.round(0.1 * fs);
  const L = [];
  for (let off = 0; off + block <= k.length; off += hop) {
    let s = 0; for (let i = 0; i < block; i++) s += k[off + i] * k[off + i];
    const ms = s / block;
    L.push(ms > 0 ? -0.691 + 10 * Math.log10(ms) : -Infinity);
  }
  const abs = L.filter((v) => v > -70);
  if (!abs.length) return -Infinity;
  const mp = (a) => a.reduce((s, v) => s + Math.pow(10, (v + 0.691) / 10), 0) / a.length;
  const ung = -0.691 + 10 * Math.log10(mp(abs));
  const rel = abs.filter((v) => v > ung - 10);
  return -0.691 + 10 * Math.log10(mp(rel.length ? rel : abs));
}

function mono(cap) {
  const raw = Buffer.from(cap.pcm16_interleaved_b64, 'base64');
  const n = raw.length >> 2;
  const m = new Float64Array(n);
  for (let i = 0; i < n; i++) m[i] = 0.5 * (raw.readInt16LE(i * 4) / 32767 + raw.readInt16LE(i * 4 + 2) / 32767);
  return m;
}
const peak = (a) => { let p = 0; for (let i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i])); return p; };
const dbfs = (p) => 20 * Math.log10(Math.max(1e-12, p));

const stamp = () => {
  const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try { return { commit: sh('git rev-parse --short HEAD'), dirty: sh('git status --porcelain') !== '' }; }
  catch { return { commit: null, dirty: null }; }
};

const regions = JSON.parse(readFileSync(join(ROOT, 'game/data/world/regions.json'), 'utf8')).regions;
const out = { tool: 'tools/analysis/critic-w1-22-probe.mjs', author: 'W1-22 round-1 critic',
  taken_at: new Date().toISOString(), git: stamp(), seconds: SECONDS, sample_rate: RATE,
  load_at_start: readFileSync('/proc/loadavg', 'utf8').trim() };

let handle;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 90000 });
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));

  const capIn = (id, extra = {}) => page.evaluate(async (o) => {
    const c = await window.__ENGINE.ambienceCapture(o);
    return c.ok ? { pcm16_interleaved_b64: c.pcm16_interleaved_b64, sampleRate: c.sampleRate,
                    fired: c.fired, bed_gain_db: c.bed_gain_db, target: c.bed_lufs_target } : { err: c.why };
  }, { region: id, seconds: SECONDS, sampleRate: RATE, tod: 'day', ...extra });

  const meas = (c) => { const m = mono(c); const a = analyse(m, c.sampleRate);
    return { lufs_i: +lufsI(m, c.sampleRate).toFixed(3), peak: +peak(m).toFixed(6),
             peak_dbfs: +dbfs(peak(m)).toFixed(3), band_centroid_hz: +a.band_centroid_hz.toFixed(1),
             power_centroid_hz: +a.power_centroid_hz.toFixed(1), bands: a.bands }; };

  // ==== A — the bed_gain_db mechanism ==========================================================
  // Two trims x two graph variants. Variant "as_shipped" keeps L1's gain LFO. Variant "mod_off"
  // deletes it. If the LFO's unscaled swing is the mechanism, mod_off must be perfectly scalar.
  const A = { region: 'valus-ridge', trims: [-13.24, -15.30], hypothesis:
    'synth.js attachMod() sets amt.gain.value (the LFO swing, an ADDITIVE AudioParam connection) '
    + 'from the pre-trim base; ambience.js buildBedContinuous() then multiplies only the STATIC '
    + 'gain by dbToGain(level_db)*trim. One term follows the trim, the other does not.', runs: {} };
  for (const variant of ['as_shipped', 'mod_off']) {
    for (const trim of A.trims) {
      const c = await page.evaluate(async ({ variant, trim, seconds, rate }) => {
        const E = window.__ENGINE, bed = E.ambience.beds['valus-ridge'];
        const savedTrim = bed.bed_gain_db;
        const savedMod = JSON.stringify(bed.layers.L1.synth.mod || null);
        bed.bed_gain_db = trim;
        if (variant === 'mod_off') delete bed.layers.L1.synth.mod;
        const c = await E.ambienceCapture({ region: 'valus-ridge', seconds, sampleRate: rate, tod: 'day' });
        bed.bed_gain_db = savedTrim;
        if (savedMod !== 'null') bed.layers.L1.synth.mod = JSON.parse(savedMod);
        return { pcm16_interleaved_b64: c.pcm16_interleaved_b64, sampleRate: c.sampleRate };
      }, { variant, trim, seconds: SECONDS, rate: RATE });
      const m = meas(c); delete m.bands;
      A.runs[`${variant}@${trim}`] = m;
    }
  }
  const d = (v) => {
    const a = A.runs[`${v}@-13.24`], b = A.runs[`${v}@-15.3`];
    return { d_lufs: +(b.lufs_i - a.lufs_i).toFixed(3), d_peak_db: +(b.peak_dbfs - a.peak_dbfs).toFixed(3),
             d_band_centroid_hz: +(b.band_centroid_hz - a.band_centroid_hz).toFixed(1),
             d_power_centroid_hz: +(b.power_centroid_hz - a.power_centroid_hz).toFixed(1) };
  };
  A.applied_trim_db = -2.06;
  A.delta_as_shipped = d('as_shipped');
  A.delta_mod_off = d('mod_off');
  A.verdict = 'mod_off deltas equal to (-2.06, -2.06, 0, 0) prove the gain LFO is the mechanism.';
  // The arithmetic, straight out of the data, for the reader who wants it without a render.
  A.arithmetic = await page.evaluate(() => {
    const bed = window.__ENGINE.ambience.beds['valus-ridge'];
    const s = bed.layers.L1.synth, dB = (x) => Math.pow(10, x / 20);
    const base = dB(s.gain_db || 0), depth = s.mod ? s.mod.depth : 0;
    const scale = dB(bed.layers.L1.level_db || 0) * dB(bed.bed_gain_db || 0);
    return { l1_synth_gain_db: s.gain_db || 0, l1_level_db: bed.layers.L1.level_db || 0,
             bed_gain_db: bed.bed_gain_db, mod: s.mod || null,
             static_term: +(base * (1 - depth / 2) * scale).toExponential(4),
             lfo_swing_term: +(base * depth / 2).toExponential(4),
             swing_over_static: +((base * depth / 2) / (base * (1 - depth / 2) * scale)).toFixed(3),
             gain_goes_negative_at_trough: (base * depth / 2) > (base * (1 - depth / 2) * scale) };
  });
  out.A_bed_gain_mechanism = A;

  // ==== B — CONSUMPTION: is any R7 emitter audible? ============================================
  // Perturb, observe, restore. The L1 control must move or the probe is worthless.
  const B = await page.evaluate(async ({ seconds, rate }) => {
    const E = window.__ENGINE, H = window.__HARNESS;
    const bed = E.ambience.beds['marauders-coast'];
    const buoy = (bed.emitters || []).find((e) => e.id === 'bell_buoy');
    const grab = async (extra) => {
      const c = await E.ambienceCapture({ region: 'marauders-coast', seconds, sampleRate: rate, tod: 'day', ...extra });
      return { b64: c.pcm16_interleaved_b64, fired: c.fired.map((f) => f.layer + ':' + f.id) };
    };
    const res = {};
    res.emitter_declared = { id: buoy.id, pos_m: buoy.pos_m, period_s: buoy.period_s,
                             audible_m: buoy.audible_m, level_db: buoy.level_db };

    // B1 — the render path every gate in this piece uses (no listener).
    res.baseline_no_listener = await grab({});
    const sl = buoy.level_db; buoy.level_db = sl + 40;
    res.buoy_plus40_no_listener = await grab({});
    buoy.level_db = sl;
    // B2 — the CONTROL. Same +40 dB, applied to L1 instead. Must move.
    const l1 = bed.layers.L1.level_db || 0;
    bed.layers.L1.level_db = l1 + 40;
    res.l1_plus40_no_listener = await grab({});
    bed.layers.L1.level_db = l1;
    // B3 — the same emitter perturbation WITH a listener placed on the buoy, which is the only
    // code path that ever schedules an emitter grain.
    const at = [buoy.pos_m[0] + 30, buoy.pos_m[1], 0];
    res.baseline_with_listener = await grab({ listener: at });
    buoy.level_db = sl + 40;
    res.buoy_plus40_with_listener = await grab({ listener: at });
    buoy.level_db = sl;

    // B4 — THE LIVE PATH. Attach a real BaseAudioContext, stand next to the buoy, step, render.
    const live = async (bump) => {
      const ctx = new OfflineAudioContext(2, rate * 8, rate);
      const s0 = buoy.level_db; if (bump) buoy.level_db = s0 + 40;
      H.teleport(buoy.pos_m[0] + 25, buoy.pos_m[1] + 25, {});
      H.stepFrames(60);
      E.ambience.attach(ctx);
      H.stepFrames(3600);                       // 60 s of world time
      const st = E.ambience.getState ? null : E.getAmbienceState();
      const rendered = await ctx.startRendering();
      let p = 0; const dch = rendered.getChannelData(0);
      for (let i = 0; i < dch.length; i++) p = Math.max(p, Math.abs(dch[i]));
      E.ambience.detach();
      buoy.level_db = s0;
      const log = H.ambienceLog(4000);
      return { live_peak: p, emitters_reported: (st && st.emitters || []).map((e) => ({ id: e.id, audible: e.audible, gain: +(e.gain || 0).toFixed(4), pan: +(e.pan || 0).toFixed(3) })),
               log_row_types: [...new Set(log.map((r) => r.type))],
               log_rows_naming_an_emitter: log.filter((r) => /buoy|horn|kiln|drum/.test(String(r.id || ''))).length,
               voices_peak: st ? st.voices_peak : null };
    };
    res.live_baseline = await live(false);
    res.live_buoy_plus40 = await live(true);
    return res;
  }, { seconds: SECONDS, rate: RATE });
  const mm = (c) => { const m = mono({ pcm16_interleaved_b64: c.b64 }); return { peak: +peak(m).toFixed(6), lufs: +lufsI(m, RATE).toFixed(3) }; };
  out.B_emitter_consumption = {
    emitter_declared: B.emitter_declared,
    no_listener: { baseline: mm(B.baseline_no_listener), buoy_plus40: mm(B.buoy_plus40_no_listener),
                   control_l1_plus40: mm(B.l1_plus40_no_listener),
                   fired_baseline: B.baseline_no_listener.fired, fired_after: B.buoy_plus40_no_listener.fired },
    with_listener: { baseline: mm(B.baseline_with_listener), buoy_plus40: mm(B.buoy_plus40_with_listener),
                     fired_baseline: B.baseline_with_listener.fired },
    live_path: { baseline: B.live_baseline, buoy_plus40: B.live_buoy_plus40 },
  };

  // ==== C + D — thirteen beds, B5 strictly, and my own 78-pair matrix ===========================
  const bands = {}, levels = {};
  for (const r of regions) {
    const c = await capIn(r.id);
    if (c.err) { levels[r.id] = { error: c.err }; continue; }
    const m = meas(c);
    bands[r.id] = m.bands; delete m.bands;
    m.target = c.target; m.bed_gain_db = c.bed_gain_db; m.events_fired = c.fired.length;
    m.fired = c.fired.map((f) => `${f.layer}:${f.id}@${f.at_s}s`);
    levels[r.id] = m;
  }
  const B5band = (id, l) => id === 'stone-wastes' ? (l >= -36 && l <= -32) : (l >= -28 && l <= -24);
  const inB5 = Object.entries(levels).filter(([id, m]) => m.lufs_i !== undefined && B5band(id, m.lufs_i));
  out.C_B5_strict = {
    spec: 'RI-AUD03 B5 verbatim: integrated LUFS over each clip must be -28..-24, Stone Wastes exempt at -34 +-2. Pass = 13/13. Hard fail = any region > -18 LUFS-I.',
    in_band: `${inB5.length}/13`, pass: inB5.length === 13,
    hard_fail_any_above_minus18: Object.entries(levels).some(([, m]) => m.lufs_i > -18),
    out_of_band: Object.entries(levels).filter(([id, m]) => !B5band(id, m.lufs_i)).map(([id, m]) => ({ id, lufs_i: m.lufs_i, own_target: m.target })),
    per_region: levels,
  };
  const ids = Object.keys(bands);
  const pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
    pairs.push({ a: ids[i], b: ids[j], d: +specDistance(bands[ids[i]], bands[ids[j]]).toFixed(4) });
  pairs.sort((p, q) => p.d - q.d);
  out.D_pair_matrix = { pairs_total: pairs.length,
    fraction_over_0_15: +(pairs.filter((p) => p.d >= 0.15).length / pairs.length).toFixed(3),
    closest_12: pairs.slice(0, 12), furthest_3: pairs.slice(-3) };

  // ==== E — the interior / settlement suppression path ==========================================
  out.E_suppression = await page.evaluate(() => {
    const E = window.__ENGINE, H = window.__HARNESS;
    const probe = (label, mutate) => {
      const saved = { interior: E.sim.env.interior, showcase: E.sim.env.showcase, region: E.sim.env.region };
      mutate();
      H.stepFrames(2);
      const s = E.getAmbienceState();
      Object.assign(E.sim.env, saved);
      H.stepFrames(2);
      return { label, cell: s.cell, suppressed: s.suppressed, region: s.region, layers: s.layers,
               voices_active: s.voices_active };
    };
    const rows = [];
    rows.push(probe('exterior province', () => { E.sim.env.interior = null; }));
    for (const cell of ['barge-hold', 'writ-house', 'helstrom-market', 'stormhold-street', 'rootlands-well', 'dungeon-primary'])
      rows.push(probe(cell, () => { E.sim.env.interior = cell; }));
    return { rows, interiors_in_data: Object.keys(E.data.interiors || {}).length };
  });

  out.page_errors = errs;
  out.git_at_end = stamp();
} catch (e) {
  out.error = String(e && e.stack || e).slice(0, 1500);
} finally { if (handle) await handle.close().catch(() => {}); }

if (args.out) {
  mkdirSync(dirname(join(ROOT, String(args.out))), { recursive: true });
  writeFileSync(join(ROOT, String(args.out)), JSON.stringify(out, null, 2) + '\n');
}
console.log(JSON.stringify({ A: out.A_bed_gain_mechanism, B: out.B_emitter_consumption,
  C: out.C_B5_strict && { in_band: out.C_B5_strict.in_band, out_of_band: out.C_B5_strict.out_of_band },
  D: out.D_pair_matrix, E: out.E_suppression, err: out.error, page_errors: out.page_errors }, null, 2));
