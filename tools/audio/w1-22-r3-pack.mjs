#!/usr/bin/env node
// THE BLIND QUALITY PACK, WITH THE RECORDINGS IN IT. W1-22 round 3. RI-AUD03 §C / B2.
//
// ============================================================================================
// WHY THIS TOOL EXISTS AND WHAT THE PREVIOUS ONE GOT WRONG
// ============================================================================================
//
// Round 3's pack (`reports/packs/w1-22-r3-hard/`) was a single JSON file of numeric feature
// vectors. Its blind judge scored 26/26 and then spent its report explaining why the number was
// worth nothing. Three findings, and this tool exists to answer all three:
//
//   1. NO AUDIO. "You have no audio," said the pack's own PROMPT.md. The judge: *"Any downstream
//      sentence saying a judge listened to this game's ambience would be false."* It also showed
//      that all 26 answers were reproducible by five lines of arithmetic over the feature vector
//      — a Euclidean distance thresholded at 1.47 — with no idea what a swamp is. A pack of
//      features tests the features. RULES.md rule 25, amended within the hour: **a pack must
//      contain the artifact under test.**
//
//   2. IT COULD NOT ASK THE ITEM'S QUESTION. The pack asked SAME/DIFFERENT while RI-AUD03 asks
//      which ambience is BETTER, and in 13 of 26 trials both recordings were the same place, so
//      "which is better" was undefined. **No quality verdict could be derived from it at all.**
//
//   3. THE `tod` STRATUM WAS FICTION. Seven recordings carried contradictory day/night labels
//      while being byte-identical, because nine of thirteen regions rendered identically day and
//      night. The stratum advertised five trials and had one. That is a defect in the WORLD, and
//      it is fixed before this pack is built — see `tools/audio/w1-22-r3-daynight.mjs`, which was
//      written first, watched go red at 9-of-13, and is green at 13-of-13 now.
//
// ============================================================================================
// WHAT THIS PACK IS
// ============================================================================================
//
// Twenty trials. Each trial is TWO 20-SECOND STEREO RECORDINGS of one place, A and B. One of them
// is ours. The other is a comparison. The judge is asked RI-AUD03's own question — **which is the
// better regional ambience** — against the item's own criteria.
//
// Each recording ships as BOTH:
//   `A.wav`  the recording itself, 20 s stereo PCM16 at 16 kHz, normalised to −23 LUFS-I
//   `A.png`  a spectrogram of that exact file — time across, frequency up, brightness = dB
//
// The WAV is the artifact under test and it is what a human plays. The PNG exists because of a
// limitation this tool cannot engineer around and will not hide: **a language-model judge in this
// project cannot decode audio.** It can look at an image. So the pack ships the sound AND a
// faithful picture of the sound, and `PROMPT.md` requires the judge to state which one it used.
// A judge that says "I looked at spectrograms" is telling the truth; a report claiming anyone
// listened would not be, and the pack is built so that nobody has to guess which happened.
//
// THE TWO COMPARISONS, and why each is defensible.
//
//   `generic` — 13 trials, one per region, daytime. Ours against **the item's own named failure**:
//     RI-AUD03 §How we lose ranks "One swamp loop" first — *"Black Marsh is a swamp, a swamp loop
//     exists in every asset library, and it will be dropped in as a placeholder in wave 1 and
//     never removed."* The comparison bed is that artifact, built from the item's text: ONE shared
//     L1 drone for every region, ONE generic wet-insect L2, an L3 on a **fixed loop timer** rather
//     than a seeded interval (the item's other named failure — "events recurring because a clock
//     came round, not because something is there"), and NO L4 at all. It is rendered through the
//     same synth engine, the same mixer and the same offline path as ours, so the only thing that
//     differs between the arms is the design. This is the floor the piece has to clear.
//
//   `night` — 7 trials, at night, in seven of the nine regions that rendered BYTE-IDENTICAL day
//     and night before this round. Ours against **our own round-2 build**: the same region, same
//     seed, same night — but with the day selection, which is exactly what round 2 shipped. The
//     question is which is the better NIGHT ambience. This is the harder stratum and it is the one
//     that tests this round's world fix directly. It is also not answerable by any script that
//     does not know what night sounds like.
//
// TELLS THIS TOOL CLOSES, each asserted rather than hoped:
//   - Every WAV is byte-identical in length (same duration, rate, channels, bit depth).
//   - Every PNG is padded to one fixed byte length with a trailing ancillary chunk, so image
//     compressibility cannot rank the arms. A looped bed compresses better than an event-driven
//     one; without the padding, `ls -l` would score this pack.
//   - Loudness carries nothing: every recording is normalised to −23 LUFS-I, per §C verbatim.
//   - Sides are swapped by a seeded coin flip and the balance is reported.
//   - Every recording in the pack is drawn from its own capture seed and NO RECORDING IS REUSED —
//     checked by SHA-256 across the whole pack, and separately checked TRIAL AGAINST TRIAL, which
//     is the check round 3's audit missed (`"identical_pairs": []` asked only whether A equalled
//     B inside one trial).
//   - No region name, stratum name, side label or ordering hint anywhere under the pack directory.
//
// WHAT THIS TOOL DOES NOT CLAIM. The `generic` stratum is a comparison against a deliberately bad
// artifact, and a judge should beat it. That is what a floor is for, and a 13/13 there is weak
// evidence, reported as weak. The `night` stratum is the real one.
//
//   node tools/audio/w1-22-r3-pack.mjs [--out reports/packs/w1-22-r4-quality] [--seconds 20]
//
// Exit 0 = pack written and the leak audit passed. 1 = the audit rejected the pack (it is moved
// to `.rejected`). 2 = the build could not be driven.

import { writeFileSync, mkdirSync, readFileSync, rmSync, existsSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const USAGE = `
w1-22-r3-pack.mjs — RI-AUD03 B2 quality pack: real recordings, ours against a comparison.

USAGE
  node tools/audio/w1-22-r3-pack.mjs [--out <dir>] [--seconds 20] [--rate 16000] [--seed 20220]

Exit 0 = written and audited clean. 1 = the leak audit rejected it. 2 = the build could not run.
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const SECONDS = Number(args.seconds || 20);          // RI-AUD03 §C: "one 20-second capture"
const RATE = Number(args.rate || 16000);
const SEED = Number(args.seed || 20220);
const LUFS_TARGET = -23;                             // §C: "normalised to -23 LUFS-I"
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const OUTDIR = join(ROOT, args.out || 'reports/packs/w1-22-r4-quality');
const REVEALDIR = OUTDIR + '.reveal';                // SIBLING, never a child (RI-MTH03 §A)
/** The seven regions the `night` stratum draws from: byte-identical day/night before this round. */
const NIGHT_REGIONS = ['clay-moor', 'crimson-coast', 'deep-marshes', 'eastern-rootlands',
                       'hive', 'salt-hills', 'thornmarsh'];

function commit() {
  try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); }
  catch { return 'unknown'; }
}

// ---- a tiny seeded PRNG, so the side coin flips and capture seeds are reproducible -----------
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- DSP ------------------------------------------------------------------------------------
function biquad(x, b0, b1, b2, a1, a2) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
/** BS.1770-4 stage 1: high shelf, +4 dB at 1681 Hz. */
function shelf(x, fs) {
  const A = Math.pow(10, 4 / 40), w = 2 * Math.PI * 1681.97 / fs;
  const cw = Math.cos(w), al = Math.sin(w) / Math.SQRT2;
  const b0 = A * ((A + 1) + (A - 1) * cw + 2 * Math.sqrt(A) * al);
  const b1 = -2 * A * ((A - 1) + (A + 1) * cw);
  const b2 = A * ((A + 1) + (A - 1) * cw - 2 * Math.sqrt(A) * al);
  const a0 = (A + 1) - (A - 1) * cw + 2 * Math.sqrt(A) * al;
  const a1 = 2 * ((A - 1) - (A + 1) * cw);
  const a2 = (A + 1) - (A - 1) * cw - 2 * Math.sqrt(A) * al;
  return biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}
function hp(x, fs, f0, q = 0.5) {
  const w = 2 * Math.PI * f0 / fs, cw = Math.cos(w), al = Math.sin(w) / (2 * q);
  const b0 = (1 + cw) / 2, b1 = -(1 + cw), b2 = (1 + cw) / 2;
  const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
  return biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}
/** Gated integrated loudness, BS.1770-4, on the mono sum. §C normalises the clip, not a channel. */
function lufsI(x, fs) {
  const y = hp(shelf(x, fs), fs, 38.13, 0.5);
  const block = Math.round(0.4 * fs), hopN = Math.round(0.1 * fs);
  const loud = [];
  for (let o = 0; o + block <= y.length; o += hopN) {
    let s = 0;
    for (let i = 0; i < block; i++) s += y[o + i] * y[o + i];
    const ms = s / block;
    loud.push(ms > 0 ? -0.691 + 10 * Math.log10(ms) : -Infinity);
  }
  const abs = loud.filter((l) => l > -70);
  if (!abs.length) return -Infinity;
  const mp = (a) => a.reduce((s, l) => s + Math.pow(10, (l + 0.691) / 10), 0) / a.length;
  const un = -0.691 + 10 * Math.log10(mp(abs));
  const rel = abs.filter((l) => l > un - 10);
  return -0.691 + 10 * Math.log10(mp(rel.length ? rel : abs));
}
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

// ---- WAV ------------------------------------------------------------------------------------
/** Canonical 16-bit PCM WAV. No metadata chunks at all — a LIST/INFO chunk is a provenance leak. */
function wav(int16Interleaved, rate, channels = 2) {
  const data = Buffer.from(int16Interleaved.buffer, int16Interleaved.byteOffset,
                           int16Interleaved.length * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * channels * 2, 28); h.writeUInt16LE(channels * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// ---- PNG spectrogram --------------------------------------------------------------------------
const SPEC_W = 480, SPEC_H = 256;   // 480 columns over 20 s = 24 columns/s; 256 log-spaced bins
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/**
 * A spectrogram of the clip, on an ABSOLUTE dB scale.
 *
 * Absolute rather than per-image-normalised, deliberately: a per-image normalisation would make
 * every picture use its full dynamic range and would hide exactly the thing §A's "Level (rel.
 * bed)" band is about — how far an event gets above the floor it sits on. Since every clip has
 * already been normalised to −23 LUFS-I, an absolute scale is fair between the arms.
 */
function spectrogram(mono, fs) {
  const N = 1024, hopN = Math.max(1, Math.floor((mono.length - N) / SPEC_W));
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  const FMIN = 40, FMAX = fs / 2;
  const px = new Uint8Array(SPEC_W * SPEC_H * 3);
  const DB_LO = -96, DB_HI = -12;
  for (let col = 0; col < SPEC_W; col++) {
    const off = Math.min(mono.length - N, col * hopN);
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = (off + i < mono.length ? mono[off + i] : 0) * win[i];
    fft(re, im);
    const bins = new Float64Array(SPEC_H);
    const cnt = new Float64Array(SPEC_H);
    for (let k = 1; k < N / 2; k++) {
      const f = k * fs / N;
      if (f < FMIN) continue;
      let b = Math.floor(SPEC_H * Math.log(f / FMIN) / Math.log(FMAX / FMIN));
      if (b < 0) b = 0; if (b >= SPEC_H) b = SPEC_H - 1;
      bins[b] += Math.hypot(re[k], im[k]) / (N / 2); cnt[b]++;
    }
    for (let b = 0; b < SPEC_H; b++) {
      const mag = cnt[b] ? bins[b] / cnt[b] : 0;
      const dB = mag > 0 ? 20 * Math.log10(mag) : -200;
      let t = (dB - DB_LO) / (DB_HI - DB_LO);
      t = Math.max(0, Math.min(1, t));
      // Dark-to-warm ramp. Perceptually monotonic enough to read structure off.
      const stops = [[10, 10, 18], [26, 50, 96], [40, 130, 126], [190, 176, 84], [250, 232, 200]];
      const s = t * (stops.length - 1);
      const i0 = Math.min(stops.length - 2, Math.floor(s)), f0 = s - i0;
      const c = stops[i0].map((v, k) => Math.round(v + (stops[i0 + 1][k] - v) * f0));
      const y = SPEC_H - 1 - b;                    // low frequencies at the bottom
      const p = (y * SPEC_W + col) * 3;
      px[p] = c[0]; px[p + 1] = c[1]; px[p + 2] = c[2];
    }
  }
  const raw = Buffer.alloc((SPEC_W * 3 + 1) * SPEC_H);
  for (let y = 0; y < SPEC_H; y++) {
    raw[y * (SPEC_W * 3 + 1)] = 0;
    Buffer.from(px.buffer, y * SPEC_W * 3, SPEC_W * 3).copy(raw, y * (SPEC_W * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SPEC_W, 0); ihdr.writeUInt32BE(SPEC_H, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return { head: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
           ihdr: chunk('IHDR', ihdr), idat: chunk('IDAT', deflateSync(raw, { level: 9 })),
           iend: chunk('IEND', Buffer.alloc(0)) };
}
/**
 * Pad every PNG to one fixed byte length with a trailing private ancillary chunk.
 *
 * THIS IS THE TELL THE R3 PACK'S BYTE-WIDTH FIX WOULD NOT HAVE CAUGHT. A generic looped bed is
 * far more compressible than an event-driven one, so `deflate` returns a much smaller IDAT for
 * the comparison arm than for ours. Without this, `wc -c *.png` recovers the key — the same class
 * of failure as the r2 pack's serialised length, in a different file format. The pad chunk is
 * `paDx`, lowercase first letter = ancillary, so every PNG reader ignores it.
 */
function padPng(parts, target) {
  const base = parts.head.length + parts.ihdr.length + parts.idat.length + parts.iend.length;
  const need = target - base - 12;                  // 12 = chunk length + type + crc overhead
  if (need < 0) return null;                        // caller grows `target` and retries
  return Buffer.concat([parts.head, parts.ihdr, parts.idat,
                        chunk('paDx', Buffer.alloc(need, 0)), parts.iend]);
}

/** Interleaved PCM16 base64 -> {L, R, mono} Float64Array. */
function decode(b64) {
  const buf = Buffer.from(b64, 'base64');
  const n = buf.length / 4;
  const L = new Float64Array(n), R = new Float64Array(n), m = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = buf.readInt16LE(i * 4) / 32768;
    R[i] = buf.readInt16LE(i * 4 + 2) / 32768;
    m[i] = (L[i] + R[i]) / 2;
  }
  return { L, R, mono: m, n };
}

// ============================================================================================
// THE COMPARISON BED — RI-AUD03 §How we lose, "One swamp loop", built from the item's own text
// ============================================================================================
// This object is injected into the page and replaces the whole bed for the comparison arm. It is
// the SAME schema the real beds use and it is rendered by the SAME `renderBedOffline`, so nothing
// separates the arms except the design. Its four properties are the four failures the item names:
//   - one L1 shared by every region ("thirteen regions, one base drone")
//   - a generic wet-insect L2 with no time-of-day or weather selection ("night is day at -8 dB")
//   - an L3 whose interval band is DEGENERATE, `[12, 12]`, so events land on a clock rather than
//     on anything in the world ("events recurring because a clock came round")
//   - L4 absent entirely, so the region has no animals of its own
const GENERIC_BED = {
  schema: 'elder-souls/ambience-bed@1',
  id: 'generic_swamp_loop',
  region: 'generic',
  bed_lufs_target: -25,
  crossfade_s: 4,
  max_voices: 8,
  layers: {
    L1: {
      id: 'swamp_amb_loop', level_db: 0, voices: 1, classes: ['pressure'],
      synth: { kind: 'noise', colour: 'brown', filter: { type: 'lowpass', hz: 320, q: 0.7 },
               gain_db: -5, width: 0.5, mod: { target: 'gain', lfo_hz: 0.05, depth: 0.08 } },
    },
    L2: {
      id: 'swamp_amb_wash', level_db: -4, voices: 2,
      sublayers: [{ when: {}, classes: ['insect_layer'],
                    synth: { kind: 'noise', colour: 'white',
                             filter: { type: 'bandpass', hz: 4200, q: 1.4 },
                             gain_db: -10, width: 0.6,
                             mod: { target: 'gain', lfo_hz: 6.0, depth: 0.2 } } }],
    },
    L3: {
      id: 'swamp_amb_oneshots', interval_s: [12, 12], level_db: -3, event_gain_db: 6,
      events: [{ id: 'swamp_plop', classes: ['water'], weight: 1, pan: [-0.3, 0.3],
                 synth: { kind: 'grain', source: 'osc', waveform: 'sine', freq_hz: 900,
                          glide_hz: [900, 380], env: { attack_s: 0.003, decay_s: 0.14 },
                          gain_db: -8 } }],
    },
    L4: null,
    L4_null_reason: 'The comparison has no creature layer. RI-AUD03 §How we lose: "both quietly '
      + 'get the standard bird layer because it is already wired up" — here there is not even '
      + 'that. This bed is the placeholder, and a placeholder has no animals.',
  },
  emitters: [],
};

// ============================================================================================
const out = {
  tool: 'tools/audio/w1-22-r3-pack.mjs',
  commit: commit(), seconds: SECONDS, sample_rate: RATE, lufs_target: LUFS_TARGET,
  selection_seed: SEED,
};

let handle, caps = null;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  const up = await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 })
    .then(() => true).catch(() => false);
  if (!up) { console.error('w1-22-r3-pack: the game did not boot.'); process.exit(2); }
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));

  caps = await page.evaluate(async ({ seconds, rate, seed, nightRegions, generic }) => {
    const E = window.__ENGINE;
    const regionIds = E.data.regions.regions.map((r) => r.id)
      .filter((id) => E.ambience.beds[id]).sort();
    const res = { region_ids: regionIds, recordings: {} };
    // EVERY CAPTURE GETS ITS OWN SEED. This is what makes "no trial reuses another trial's
    // recording" true by construction rather than by luck, and it is checked afterwards by hash.
    let s = seed;
    const nextSeed = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0);
    const grab = async (key, opts) => {
      const c = await E.ambienceCapture({ seconds, sampleRate: rate, listener: null, ...opts });
      res.recordings[key] = c.ok
        ? { b64: c.pcm16_interleaved_b64, fired: (c.fired || []).map((f) => f.id) }
        : { error: c.why || 'capture failed' };
    };

    // --- `generic` stratum: ours (day) against the one-swamp-loop bed (day) -------------------
    for (const id of regionIds) {
      await grab(`ours_day/${id}`, { region: id, tod: 'day', seed: nextSeed() });
      // Install the comparison bed under a scratch id, render, remove. The bed object is a plain
      // data record and the renderer reads nothing else about the region, so this is the same
      // code path with different content — which is the whole point.
      E.ambience.beds.__generic = JSON.parse(JSON.stringify(generic));
      await grab(`generic_day/${id}`, { region: '__generic', tod: 'day', seed: nextSeed() });
      delete E.ambience.beds.__generic;
    }

    // --- `night` stratum: ours at night against the ROUND-2 build's night ---------------------
    // Round 2's night, in these regions, was byte-identical to its day. Reproducing it is
    // therefore exactly a `tod: 'day'` render of today's bed — the day selection, which is what
    // those beds had at every hour. Both sides are the same region, same duration, same
    // normalisation; only the selection differs.
    for (const id of nightRegions) {
      await grab(`ours_night/${id}`, { region: id, tod: 'night', seed: nextSeed() });
      await grab(`round2_night/${id}`, { region: id, tod: 'day', seed: nextSeed() });
    }
    return res;
  }, { seconds: SECONDS, rate: RATE, seed: SEED, nightRegions: NIGHT_REGIONS, generic: GENERIC_BED });
} catch (e) {
  console.error('w1-22-r3-pack: ' + (e && e.stack || e));
  process.exitCode = 2;
} finally {
  if (handle && handle.close) await handle.close();
}
if (!caps) process.exit(2);

// ============================================================================================
// Node side: normalise, write WAV + PNG, assemble the pack
// ============================================================================================
const rnd = mulberry(SEED ^ 0x9e37);
const regionIds = caps.region_ids;
const trials = [];
let n = 0;
const mk = (stratum, region, oursKey, compKey) => {
  n++;
  const id = `T${String(n).padStart(2, '0')}`;
  const oursIsA = rnd() < 0.5;                 // the side coin flip, seeded and recorded
  trials.push({ id, stratum, region,
                A: oursIsA ? oursKey : compKey, B: oursIsA ? compKey : oursKey,
                ours_side: oursIsA ? 'A' : 'B' });
};
for (const r of regionIds) mk('generic', r, `ours_day/${r}`, `generic_day/${r}`);
for (const r of NIGHT_REGIONS) mk('night', r, `ours_night/${r}`, `round2_night/${r}`);

// Prepare every recording once: decode, normalise to -23 LUFS-I, quantise, build the PNG parts.
const prepared = {};
for (const [key, rec] of Object.entries(caps.recordings)) {
  if (rec.error) { console.error(`w1-22-r3-pack: ${key}: ${rec.error}`); process.exit(2); }
  const d = decode(rec.b64);
  const measured = lufsI(d.mono, RATE);
  // §C verbatim: "normalised to -23 LUFS-I so loudness carries no information". Clamp the gain so
  // a pathologically quiet clip cannot be lifted into clipping; report if the clamp ever bites.
  let g = Math.pow(10, (LUFS_TARGET - measured) / 20);
  let clipped = false;
  let pk = 0;
  for (let i = 0; i < d.n; i++) pk = Math.max(pk, Math.abs(d.L[i]), Math.abs(d.R[i]));
  if (pk * g > 0.999) { g = 0.999 / pk; clipped = true; }
  const il = new Int16Array(d.n * 2);
  const mono = new Float64Array(d.n);
  for (let i = 0; i < d.n; i++) {
    const l = Math.max(-1, Math.min(1, d.L[i] * g)), r = Math.max(-1, Math.min(1, d.R[i] * g));
    il[i * 2] = Math.round(l * 32767); il[i * 2 + 1] = Math.round(r * 32767);
    mono[i] = (l + r) / 2;
  }
  prepared[key] = {
    wav: wav(il, RATE), png: spectrogram(mono, RATE),
    lufs_before: +measured.toFixed(2), lufs_after: +lufsI(mono, RATE).toFixed(2),
    gain_db: +(20 * Math.log10(g)).toFixed(2), headroom_clamped: clipped,
    fired: rec.fired,
  };
}

// One PNG byte length for the whole pack: the largest natural size, rounded up.
let pngTarget = 0;
for (const p of Object.values(prepared)) {
  const parts = p.png;
  pngTarget = Math.max(pngTarget, parts.head.length + parts.ihdr.length + parts.idat.length
                                  + parts.iend.length + 12);
}
pngTarget = Math.ceil(pngTarget / 1024) * 1024 + 1024;
for (const p of Object.values(prepared)) {
  p.pngBuf = padPng(p.png, pngTarget);
  if (!p.pngBuf) { console.error('w1-22-r3-pack: PNG padding target too small'); process.exit(2); }
}

// ---- write ------------------------------------------------------------------------------------
for (const d of [OUTDIR, REVEALDIR]) { if (existsSync(d)) rmSync(d, { recursive: true, force: true }); }
mkdirSync(OUTDIR, { recursive: true });
mkdirSync(REVEALDIR, { recursive: true });

const manifest = { pack: 'w1-22-r4-quality', item: 'RI-AUD03', check: 'B2 (quality)',
                   question: 'which of A and B is the better regional ambience',
                   trials: [], seconds: SECONDS, sample_rate: RATE, channels: 2,
                   bit_depth: 16, lufs_normalised_to: LUFS_TARGET,
                   spectrogram: { width: SPEC_W, height: SPEC_H, db_floor: -96, db_ceiling: -12,
                                  axis: 'time across, frequency up (log, 40 Hz to Nyquist), '
                                        + 'brightness = level' } };
const sha = (b) => createHash('sha256').update(b).digest('hex');
const hashes = {};
for (const t of trials) {
  const dir = join(OUTDIR, 'trials', t.id);
  mkdirSync(dir, { recursive: true });
  for (const side of ['A', 'B']) {
    const p = prepared[t[side]];
    writeFileSync(join(dir, `${side}.wav`), p.wav);
    writeFileSync(join(dir, `${side}.png`), p.pngBuf);
    hashes[`${t.id}/${side}`] = { wav: sha(p.wav), png: sha(p.pngBuf), source: t[side] };
  }
  manifest.trials.push({ id: t.id,
    A: { wav: `trials/${t.id}/A.wav`, spectrogram: `trials/${t.id}/A.png` },
    B: { wav: `trials/${t.id}/B.wav`, spectrogram: `trials/${t.id}/B.png` } });
}
writeFileSync(join(OUTDIR, 'pack.json'), JSON.stringify(manifest, null, 2) + '\n');

// ---- the leak audit ---------------------------------------------------------------------------
const audit = { pack: 'w1-22-r4-quality', commit: out.commit, checks: {}, rejected: [] };
const fail = (k, v, why) => { audit.checks[k] = { pass: false, value: v, why }; audit.rejected.push(k); };
const pass = (k, v, why) => { audit.checks[k] = { pass: true, value: v, why }; };

// 1. every WAV the same byte length
const wavLens = new Set(Object.values(prepared).map((p) => p.wav.length));
wavLens.size === 1
  ? pass('wav_byte_length_uniform', [...wavLens][0], 'file size carries zero bits')
  : fail('wav_byte_length_uniform', [...wavLens], 'a size threshold could rank the arms');
// 2. every PNG the same byte length — the compressibility channel
const pngLens = new Set(Object.values(prepared).map((p) => p.pngBuf.length));
pngLens.size === 1
  ? pass('png_byte_length_uniform', [...pngLens][0],
         'a looped bed deflates smaller than an event-driven one; padding kills that channel')
  : fail('png_byte_length_uniform', [...pngLens], 'image compressibility ranks the arms');
// 3. no recording reused anywhere in the pack
const allWav = Object.values(hashes).map((h) => h.wav);
const dupWav = allWav.length - new Set(allWav).size;
dupWav === 0
  ? pass('no_recording_reused', `${allWav.length} slots, ${new Set(allWav).size} distinct`,
         'every slot is its own capture seed')
  : fail('no_recording_reused', dupWav, 'a judge who recognises a repeat gets an answer free');
// 4. THE CHECK THE ROUND-3 AUDIT MISSED: no trial is another trial's pair.
const pairKeys = trials.map((t) => {
  const a = hashes[`${t.id}/A`].wav, b = hashes[`${t.id}/B`].wav;
  return [a, b].sort().join('|');                  // unordered, so a side swap is still a repeat
});
const dupPairs = pairKeys.length - new Set(pairKeys).size;
dupPairs === 0
  ? pass('no_trial_repeats_another_trial', `${pairKeys.length} trials, ${new Set(pairKeys).size} distinct pairs`,
         'round 3 asked only whether A equalled B WITHIN a trial; two of its trials were another '
         + 'two with the sides swapped, so two observations were counted twice, in two strata')
  : fail('no_trial_repeats_another_trial', dupPairs, 'the effective N is smaller than the trial count');
// 5. A is ours in roughly half the trials
const aOurs = trials.filter((t) => t.ours_side === 'A').length;
(aOurs > 0 && aOurs < trials.length)
  ? pass('sides_swapped', `${aOurs}/${trials.length} have ours on A`, 'seeded coin flip per trial')
  : fail('sides_swapped', aOurs, 'a fixed side is a free answer');
// 6. loudness carries nothing
const lufsAfter = Object.values(prepared).map((p) => p.lufs_after);
const lufsSpread = +(Math.max(...lufsAfter) - Math.min(...lufsAfter)).toFixed(2);
lufsSpread <= 0.5
  ? pass('loudness_normalised', `spread ${lufsSpread} LU about ${LUFS_TARGET}`, 'RI-AUD03 §C verbatim')
  : fail('loudness_normalised', lufsSpread, 'the louder arm can be picked without judging it');
// 7. no names anywhere under the pack directory
const forbidden = [...regionIds, 'generic', 'round2', 'ours', 'night', 'day', 'stratum', 'swamp_amb'];
const packText = readFileSync(join(OUTDIR, 'pack.json'), 'utf8').toLowerCase();
const leaked = forbidden.filter((w) => packText.includes(w.toLowerCase()));
leaked.length === 0
  ? pass('no_names_in_pack', 0, 'no region, arm, stratum or side label in the shipped manifest')
  : fail('no_names_in_pack', leaked, 'the manifest names the arms');
// 8. the trial ORDER must not be the truth order
const runs = (() => { let m = 1, c = 1; for (let i = 1; i < trials.length; i++) {
  if (trials[i].ours_side === trials[i - 1].ours_side) { c++; m = Math.max(m, c); } else c = 1; } return m; })();
runs <= Math.ceil(trials.length / 3)
  ? pass('no_long_side_run', runs, 'longest run of trials with ours on the same side')
  : fail('no_long_side_run', runs, 'a run that long is a pattern a judge can ride');

audit.strata = { generic: trials.filter((t) => t.stratum === 'generic').length,
                 night: trials.filter((t) => t.stratum === 'night').length };
// 9. THE `tod` STRATUM MUST BE BACKED BY AUDIO THAT ACTUALLY DIFFERS. This is the acceptance
//    criterion the round-3 pack failed: it advertised five day/night trials and had one, because
//    the two sides were byte-identical for four of them. Here the two sides of every `night`
//    trial are checked to be different recordings, and the difference is quoted.
const nightSame = trials.filter((t) => t.stratum === 'night')
  .filter((t) => hashes[`${t.id}/A`].wav === hashes[`${t.id}/B`].wav);
nightSame.length === 0
  ? pass('night_stratum_is_real', `${audit.strata.night}/${audit.strata.night} trials have two `
         + 'different recordings', 'ours-at-night against round 2\'s night, which was its day')
  : fail('night_stratum_is_real', nightSame.map((t) => t.id),
         'the stratum tests a contrast the audio does not have');

audit.pass = audit.rejected.length === 0;

// ---- PROMPT.md --------------------------------------------------------------------------------
const PROMPT = `# Blind pack — read this first

You have **${trials.length} trials**. Each is a folder under \`trials/\` holding four files:

    A.wav   A.png   B.wav   B.png

\`A.wav\` and \`B.wav\` are two twenty-second stereo recordings of ambient sound from **the same
place in a game world**. \`A.png\` and \`B.png\` are spectrograms of those exact two files — time
runs left to right over the twenty seconds, frequency runs bottom to top on a log scale from
40 Hz to 8 kHz, and brightness is level on a fixed absolute scale shared by every image in the
pack.

**Both recordings in a trial are candidates for the same location.** They are not the same
recording and they are not two different places.

## The question

For each trial, answer:

> **Which of these two is the better ambience for this place? A or B.**

"Better" means, in this order:

1. **Place-ness.** Does it sound like *somewhere specific* rather than like generic atmosphere?
   Could you tell this location from another with your eyes shut?
2. **Events that mean something.** Do things happen because something is *there*, or because a
   clock came round? A sound that recurs on an exact fixed period is a loop timer, and a loop
   timer is the failure mode, not the feature.
3. **Deliberate silence and absence.** A quiet or empty ambience can be the better one. Absence
   is a design statement, not missing work.
4. **Specificity and strangeness.** Is there anything here you have not heard before, or is it
   the standard library of frogs, water and wind?

## How to answer

Write one line per trial, in this exact format:

    T01 <A|B> | <high|medium|low> | <one sentence of reason, citing something specific you
                                     heard or saw in the picture>

Then, at the end, answer these four in your own words:

- **Did you listen, or did you look?** Say plainly which. If your context cannot decode a WAV
  file, say so and say you judged the spectrograms. **Do not describe yourself as having listened
  if you did not.** A previous pack in this project produced a report that read like a listening
  test and was not one, and that is the single most important thing to get right here.
- **Was any trial answerable without judgement?** If you found a mechanical rule — a file
  property, a repeated image, an ordering pattern, a threshold on one number — that answers
  trials without engaging with the content, say what it was and how many trials it answers. You
  are the check on the builder's own audit, and finding one is a success, not a complaint.
- **Which trials did you guess?** Name them.
- **Is either arm systematically worse?** If after a few trials you formed a theory about what
  distinguishes the two candidates, say what it was and when you formed it.

## What you are not told, and must not try to find out

You are not told which of A and B is which, what the places are, how many strata there are, or
what the pack is testing. There is a reveal directory **outside this folder** — do not open it,
do not list its parent, and do not read anything in this repository about this pack, until your
answers are written to disk. Write your answers first, then look.

## Notes that are not hints

- Every recording is normalised to −23 LUFS-I, so **loudness carries no information**. Do not
  prefer the louder one; there isn't one.
- Every \`.wav\` in the pack is exactly the same number of bytes, and so is every \`.png\`. File
  size carries no information either. This is asserted by the builder's audit and you should
  verify it rather than believe it.
- The recordings are synthesised, not sampled. Nothing here is a field recording, and neither arm
  has an advantage from that.
`;
writeFileSync(join(OUTDIR, 'PROMPT.md'), PROMPT);

// ---- the reveal (SIBLING directory) ------------------------------------------------------------
const mapping = {
  pack: 'w1-22-r4-quality', commit: out.commit,
  do_not_give_this_to_the_judge: true,
  arms: {
    ours: 'the shipped build at this commit',
    generic: 'RI-AUD03 §How we lose "One swamp loop": one shared L1 for every region, a generic '
      + 'wet-insect L2 with no time-of-day selection, an L3 on a DEGENERATE [12,12] interval band '
      + '(a loop timer, not a seeded interval), and no L4 at all. Rendered through the same synth '
      + 'engine, mixer and offline path as ours.',
    round2_night: 'the round-2 build\'s night in the nine regions where night rendered '
      + 'BYTE-IDENTICAL to day — i.e. the day selection, which is what those beds played at every '
      + 'hour before this round.',
  },
  scoring: 'ours_preferred / trials, per stratum. The `generic` stratum is a FLOOR and a high '
    + 'score there is weak evidence; the `night` stratum is the one that tests this round\'s fix.',
  trials: trials.map((t) => ({ id: t.id, stratum: t.stratum, region: t.region,
                               ours_side: t.ours_side, A: t.A, B: t.B,
                               A_sha256: hashes[`${t.id}/A`].wav, B_sha256: hashes[`${t.id}/B`].wav,
                               events_A: prepared[t.A].fired, events_B: prepared[t.B].fired })),
  levels: Object.fromEntries(Object.entries(prepared).map(([k, p]) =>
    [k, { lufs_before: p.lufs_before, lufs_after: p.lufs_after, gain_db: p.gain_db,
          headroom_clamped: p.headroom_clamped }])),
};
writeFileSync(join(REVEALDIR, 'mapping.json'), JSON.stringify(mapping, null, 2) + '\n');
writeFileSync(join(REVEALDIR, 'leak-audit.json'), JSON.stringify(audit, null, 2) + '\n');

out.trials = trials.length;
out.pack_dir = OUTDIR.replace(ROOT + '/', '');
out.reveal_dir = REVEALDIR.replace(ROOT + '/', '');
out.audit_pass = audit.pass;
mkdirSync(join(ROOT, 'reports/w1-22-r3'), { recursive: true });
writeFileSync(join(ROOT, 'reports/w1-22-r3/pack-build.json'), JSON.stringify(out, null, 2) + '\n');

for (const [k, c] of Object.entries(audit.checks)) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${k.padEnd(32)} ${JSON.stringify(c.value)}`);
}
console.log(`\n${trials.length} trials, ${trials.length * 2} recordings, `
  + `${(Object.values(prepared).reduce((s, p) => s + p.wav.length + p.pngBuf.length, 0) / 1048576).toFixed(1)} MB`);
console.log(`pack   ${out.pack_dir}`);
console.log(`reveal ${out.reveal_dir}  — DO NOT GIVE THIS TO THE JUDGE`);
if (!audit.pass) {
  renameSync(OUTDIR, OUTDIR + '.rejected');
  console.error(`\nLEAK AUDIT REJECTED THE PACK: ${audit.rejected.join(', ')}. Moved to .rejected.`);
  process.exit(1);
}
