#!/usr/bin/env node
// audio-pack-b2.mjs — RI-AUD03 B2 PACK BUILDER. Written by the W1-22 round-1 critic.
// Declared under method_deviations.
//
// RI-AUD03 B2's own named tool, `tools/blind/audio-pack.mjs`, is an ABSENCE-REPORTER: it boots
// the build, confirms combat impact audio is missing, and exits 20. It has never built a pack and
// cannot, because it predates the beds. TOOL-LOOP rule 1 says build the instrument the method
// describes. This is that instrument for the ambience half.
//
// WHAT A CLIP IS HERE, AND THE HONEST LIMIT ON IT.
// RI-AUD03 §C wants a 20-second .wav handed to a judge with ears. No judge available to this
// project has ears. So each clip is presented as a MECHANICALLY DERIVED, LABEL-FREE rendering of
// the actual PCM the engine produced: 24 log-spaced band levels in dB relative to the clip's own
// loudest band, the loudness, the spectral centroid, the stereo width, and a list of transient
// onsets with GENERIC descriptors (time, duration, which band). No region name, no synth id, no
// layer name, no filename, no ordering that tracks the region list. Both members of every pair go
// through the identical path, so the transformation cannot itself be a tell (RI-MTH03 §B).
//
// This is weaker than listening. It is stronger than a cosine threshold, because a judge decides.
//
// THE CATCH TRIALS ARE NOT OPTIONAL AND THE ITEM DOES NOT HAVE THEM.
// B2 as written scores `separation = (# correctly answered DIFFERENT)/78` over 78 pairs that are
// ALL genuinely different regions. A judge that answers DIFFERENT to everything scores 1.000. That
// is a probe that cannot fail. Every pack this tool builds therefore mixes in SAME pairs — one
// region rendered twice at two different capture seeds — and reports `false_different_rate`
// alongside separation. If the catch rate is bad, the separation number means nothing.
//
//   node tools/blind/audio-pack-b2.mjs --out reports/w1-22-critic/b2 --seed 22071

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const OUT = join(ROOT, String(args.out || 'reports/w1-22-critic/b2'));
const REVEAL = OUT + '.reveal';                     // SIBLING, never a child. RI-MTH03 §A.
const SEED = Number(args.seed || 22071);
const SECONDS = 20, RATE = 16000;

// A small deterministic PRNG so the draw is reproducible from the recorded seed.
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---- DSP (same independent implementation as the critic probe) ---------------------------------
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const n2 = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = n2;
      } }
  }
}
const NB = 24, FMIN = 40, FMAX = 8000;
const EDGES = []; for (let b = 0; b <= NB; b++) EDGES.push(FMIN * Math.pow(FMAX / FMIN, b / NB));
function bandsOf(x, fs) {
  const N = 2048, bands = new Float64Array(NB), win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  for (let off = 0; off + N <= x.length; off += N) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[off + i] * win[i];
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = k * fs / N; if (f < FMIN || f >= FMAX) continue;
      let b = Math.floor(NB * Math.log(f / FMIN) / Math.log(FMAX / FMIN));
      if (b < 0) b = 0; if (b >= NB) b = NB - 1;
      bands[b] += Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    } }
  let t = 0; for (let b = 0; b < NB; b++) t += bands[b];
  return { norm: Array.from(bands, (v) => (t ? v / t : 0)), raw: Array.from(bands) };
}
function bq(x, b0, b1, b2, a1, a2) { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
function lufsI(x, fs) {
  const A = Math.pow(10, 0.1), w = 2 * Math.PI * 1681.97 / fs, cw = Math.cos(w), al = Math.sin(w) * Math.SQRT1_2, sA = Math.sqrt(A);
  const s = [A * ((A + 1) + (A - 1) * cw + 2 * sA * al), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - 2 * sA * al),
             (A + 1) - (A - 1) * cw + 2 * sA * al, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - 2 * sA * al];
  const w2 = 2 * Math.PI * 38.13 / fs, c2 = Math.cos(w2), a2 = Math.sin(w2);
  const h = [(1 + c2) / 2, -(1 + c2), (1 + c2) / 2, 1 + a2, -2 * c2, 1 - a2];
  const k = bq(bq(x, s[0] / s[3], s[1] / s[3], s[2] / s[3], s[4] / s[3], s[5] / s[3]),
               h[0] / h[3], h[1] / h[3], h[2] / h[3], h[4] / h[3], h[5] / h[3]);
  const bl = Math.round(0.4 * fs), hop = Math.round(0.1 * fs), L = [];
  for (let o = 0; o + bl <= k.length; o += hop) { let q = 0; for (let i = 0; i < bl; i++) q += k[o + i] * k[o + i];
    const ms = q / bl; L.push(ms > 0 ? -0.691 + 10 * Math.log10(ms) : -Infinity); }
  const abs = L.filter((v) => v > -70); if (!abs.length) return -Infinity;
  const mp = (a) => a.reduce((q, v) => q + Math.pow(10, (v + 0.691) / 10), 0) / a.length;
  const u = -0.691 + 10 * Math.log10(mp(abs));
  const r = abs.filter((v) => v > u - 10);
  return -0.691 + 10 * Math.log10(mp(r.length ? r : abs));
}
function decode(b64) { const raw = Buffer.from(b64, 'base64'); const n = raw.length >> 2;
  const L = new Float64Array(n), R = new Float64Array(n);
  for (let i = 0; i < n; i++) { L[i] = raw.readInt16LE(i * 4) / 32767; R[i] = raw.readInt16LE(i * 4 + 2) / 32767; }
  return { L, R, M: Float64Array.from(L, (v, i) => 0.5 * (v + R[i])) }; }

/** Onsets from a short-time energy envelope. Descriptors are GENERIC by construction: the tool
 *  never sees an event id, only the waveform, so it cannot leak one. */
function onsets(x, fs) {
  const H = Math.round(fs * 0.01), env = [];
  for (let o = 0; o + H <= x.length; o += H) { let s = 0; for (let i = 0; i < H; i++) s += x[o + i] * x[o + i]; env.push(Math.sqrt(s / H)); }
  const sorted = [...env].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)] || 1e-9;
  const out = []; let i = 1;
  while (i < env.length) {
    if (env[i] > med * 3.5 && env[i] > env[i - 1] * 1.6) {
      let j = i; while (j < env.length && env[j] > med * 1.5) j++;
      out.push({ at_s: +(i * H / fs).toFixed(2), duration_s: +((j - i) * H / fs).toFixed(2),
                 rise_db: +(20 * Math.log10(env[i] / Math.max(1e-9, env[i - 1]))).toFixed(1) });
      i = j + 1;
    } else i++;
  }
  return out.slice(0, 12);
}

/** The label-free clip description a judge sees. */
function profile(cap) {
  const { L, R, M } = decode(cap.pcm16_interleaved_b64);
  const fs = cap.sampleRate;
  const b = bandsOf(M, fs);
  const maxB = Math.max(...b.raw) || 1;
  const rel = b.raw.map((v) => +(20 * Math.log10(Math.max(1e-6, v / maxB))).toFixed(1));
  let num = 0, den = 0;
  for (let i = 0; i < NB; i++) { num += Math.sqrt(EDGES[i] * EDGES[i + 1]) * b.norm[i]; den += b.norm[i]; }
  let sl = 0, sr = 0, sc = 0;
  for (let i = 0; i < M.length; i++) { sl += L[i] * L[i]; sr += R[i] * R[i]; sc += L[i] * R[i]; }
  const corr = sc / Math.max(1e-12, Math.sqrt(sl * sr));
  let pk = 0; for (let i = 0; i < M.length; i++) pk = Math.max(pk, Math.abs(M[i]));
  return {
    duration_s: +(M.length / fs).toFixed(1),
    loudness_lufs: +lufsI(M, fs).toFixed(2),
    crest_factor_db: +(20 * Math.log10(pk / Math.max(1e-9, Math.pow(10, (lufsI(M, fs) + 0.691) / 20)))).toFixed(1),
    spectral_centroid_hz: +num.toFixed(0),
    stereo_correlation: +corr.toFixed(3),
    band_levels_db_rel_loudest: Object.fromEntries(rel.map((v, i) =>
      [`${Math.round(EDGES[i])}-${Math.round(EDGES[i + 1])}Hz`, v])),
    transient_onsets: onsets(M, fs),
    _bands_norm: b.norm,
  };
}

// ---- build --------------------------------------------------------------------------------------
const regions = JSON.parse(readFileSync(join(ROOT, 'game/data/world/regions.json'), 'utf8')).regions.map((r) => r.id);
const stamp = (() => { const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8' }).trim();
  try { return { commit: sh('git rev-parse --short HEAD'), dirty: sh('git status --porcelain') !== '' }; } catch { return {}; } })();

let handle;
const clips = {};
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 90000 });
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));
  // Two capture seeds per region. Seed A is the clip; seed B exists so a SAME pair can be two
  // genuinely different recordings of one place rather than the same file twice.
  for (const id of regions) {
    for (const [tag, seed] of [['a', 0xa3b1], ['b', 0x5c27]]) {
      const c = await page.evaluate(async (o) => {
        const r = await window.__ENGINE.ambienceCapture(o);
        return r.ok ? { pcm16_interleaved_b64: r.pcm16_interleaved_b64, sampleRate: r.sampleRate } : null;
      }, { region: id, seconds: SECONDS, sampleRate: RATE, tod: 'day', seed });
      if (c) clips[`${id}#${tag}`] = profile(c);
    }
  }
} finally { if (handle) await handle.close().catch(() => {}); }

// ---- sampling, exactly as pre-registered ---------------------------------------------------------
const cos = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return 1 - d / Math.sqrt(x * y); };
const all = [];
for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++)
  all.push({ a: regions[i], b: regions[j], d: cos(clips[regions[i] + '#a']._bands_norm, clips[regions[j] + '#a']._bands_norm) });
all.sort((p, q) => p.d - q.d);
const hard = all.slice(0, 12);
const rest = all.slice(12);
const rnd = mulberry(SEED);
const picked = [];
const pool = [...rest];
while (picked.length < 12 && pool.length) picked.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
const catchRegions = [];
{ const p = [...regions]; while (catchRegions.length < 8 && p.length) catchRegions.push(p.splice(Math.floor(rnd() * p.length), 1)[0]); }

const trials = [
  ...hard.map((p) => ({ truth: 'DIFFERENT', stratum: 'hard', A: p.a + '#a', B: p.b + '#b', proxy_distance: +p.d.toFixed(4) })),
  ...picked.map((p) => ({ truth: 'DIFFERENT', stratum: 'random', A: p.a + '#a', B: p.b + '#b', proxy_distance: +p.d.toFixed(4) })),
  ...catchRegions.map((r) => ({ truth: 'SAME', stratum: 'catch', A: r + '#a', B: r + '#b',
    proxy_distance: +cos(clips[r + '#a']._bands_norm, clips[r + '#b']._bands_norm).toFixed(4) })),
];
// Shuffle so stratum is not inferable from position, and randomise which side is A.
for (let i = trials.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [trials[i], trials[j]] = [trials[j], trials[i]]; }
for (const t of trials) if (rnd() < 0.5) { const s = t.A; t.A = t.B; t.B = s; }
trials.forEach((t, i) => { t.trial = `T${String(i + 1).padStart(2, '0')}`; });

const PROMPT = `You are judging pairs of sound recordings from a video game world.

For each trial you are given two 20-second ambient recordings, RECORDING A and RECORDING B,
described as measured acoustic data: band levels, loudness, spectral centre, stereo correlation
and the transient events detected in each. You cannot hear them; the numbers are all there is.
Nothing in the description names a place, and you must not try to work out which game or which
region anything is from. Judge only whether the two recordings sound like they were made in the
same place.

For each trial answer on ONE line, exactly:

  <TRIAL ID>: SAME|DIFFERENT | <one sentence of reason>

"Are these two 20-second recordings from the same place in a game world, or different places?"

Guess even when unsure. Do not hedge, do not decline, do not answer "equivalent" or "unclear" —
those count as protocol violations. Some pairs really are the same place recorded twice; some are
different places. You are not told how many of each.
`;

mkdirSync(OUT, { recursive: true });
mkdirSync(REVEAL, { recursive: true });

const strip = (p) => { const q = { ...p }; delete q._bands_norm; return q; };
const trialsPublic = trials.map((t) => ({ trial: t.trial, RECORDING_A: strip(clips[t.A]), RECORDING_B: strip(clips[t.B]) }));
writeFileSync(join(OUT, 'PROMPT.md'), PROMPT);
writeFileSync(join(OUT, 'trials.json'), JSON.stringify(trialsPublic, null, 2) + '\n');
const sha = (s) => createHash('sha256').update(s).digest('hex');
writeFileSync(join(OUT, 'pack.json'), JSON.stringify({
  pack_id: `w1-22-b2-${stamp.commit}`, item: 'RI-AUD03', check: 'B2', kind: 'audio-profile',
  question: 'Are these two 20-second recordings from the same place in a game world, or different places?',
  trials: trials.length, seed: SEED, seconds: SECONDS, sample_rate: RATE, git: stamp,
  trials_sha256: sha(JSON.stringify(trialsPublic)),
  contains_no_mapping: true,
}, null, 2) + '\n');
writeFileSync(join(REVEAL, 'mapping.json'), JSON.stringify({
  seed: SEED, built_at: new Date().toISOString(), git: stamp,
  strata: { hard: 12, random: 12, catch: 8 },
  trials: trials.map((t) => ({ trial: t.trial, truth: t.truth, stratum: t.stratum, A: t.A, B: t.B, proxy_distance: t.proxy_distance })),
}, null, 2) + '\n');
console.log(`pack: ${OUT}  trials=${trials.length}  reveal=${REVEAL}`);
console.log(`catch-pair proxy distances (same region, two seeds): ${trials.filter((t) => t.stratum === 'catch').map((t) => t.proxy_distance).join(', ')}`);
console.log(`hard-stratum distances: ${hard.map((h) => h.d.toFixed(3)).join(', ')}`);
