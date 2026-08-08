#!/usr/bin/env node
// W1-22 ROUND-2 CRITIC'S BLIND PACK BUILDER — THE HARDER PACK THE B2 JUDGE ASKED FOR.
//
// WHY THIS EXISTS. `corpus/90-verdicts/wave1/W1-22-B2-blind.md` scored 32/32 on the round-1 pack
// and then said, in its own §9, that the score should not be cited:
//
//   "32/32 with a 166x margin does not demonstrate that a judge can tell these regions apart; it
//    demonstrates that the pack's DSP front-end already separated them before I saw anything...
//    A pack that scores 1.0000 on its first outing should be made harder before its number is
//    cited, and the obvious way is to stop comparing whole-region beds and start comparing a
//    region against itself at different times of day, or against a neighbouring region after both
//    are loudness- and spectrum-matched."
//
// The round-1 pack handed each judge ONE TIME-AVERAGED 24-band spectrum per clip. A time-averaged
// spectrum is, by construction, the tone colour and nothing else: every event, every rhythm, every
// silence is integrated away before the judge sees it. So the pack could only ever measure tone
// colour, and tone colour is the one channel this build implements well.
//
// THIS PACK CLOSES BOTH CHANNELS AND OPENS THE ONE THAT WAS SHUT.
//
//   1. LOUDNESS is normalised out (as round 1 did) — and so is TONE COLOUR. Every band level is
//      reported as a deviation from THAT CLIP'S OWN median level in THAT BAND, so the long-term
//      spectrum of every recording in the pack is flat by construction and carries exactly zero
//      bits. This is the "spectrum-matched" half of the judge's request, done exactly rather than
//      approximately: it is not that the two clips have been made similar, it is that the
//      stationary spectrum has been removed from the representation.
//
//   2. WHAT REMAINS IS TIME. Each recording carries a 120-frame x 6-band normalised spectrogram at
//      0.5 s resolution, a per-frame broadband level deviation, the crest factor, and the stereo
//      correlation. If two regions differ in when things happen, how often, how loud relative to
//      their own floor, and how wide they sit, a judge can still separate them. If they do not,
//      the honest answer is that these regions are one place in thirteen colours.
//
//   3. A TIME-OF-DAY STRATUM. Some trials are the same region at day and at night. Those are SAME
//      pairs — it is one place — and RI-AUD03 R5 says night is "a different L2/L4 selection, not a
//      filter", so a correct build makes them look different while still being the same place.
//      That is the trap the judge asked for and it cuts both ways.
//
// WHAT THIS PACK IS NOT. It is NOT RI-AUD03 B2 and its number must not be quoted as B2.
// B2 asks "can a listener tell these places apart", and tone colour is a legitimate answer to that
// question that this pack deliberately withholds. This is a STRESS TEST whose result is a lower
// bound and a diagnosis: it answers "is there anything besides tone colour?" Reported as such.
//
// LEAK DISCIPLINE (RI-MTH03 M6, and the three leaks the round-1 judge found in the round-1 pack):
//   * the reveal key is written to a SIBLING directory, never a child;
//   * `JUDGE.md` (which stated the class balance) is NOT written into the pack directory — the
//     operator instructions live in the reveal sibling;
//   * this builder prints NO per-stratum statistic and NO distance to stdout;
//   * `trials.json` is written ONCE and hashed from the bytes on disk afterwards, so the declared
//     hash always describes the file a judge reads. Round 1's pack was text-substituted after
//     hashing and its declared hash did not match.
//
// FALSIFIABILITY (RULES.md rule 4). `--sabotage identical` builds the pack with every DIFFERENT
// pair replaced by the SAME recording twice. A judge — or the leak audit below — must then be
// unable to find any DIFFERENT pair at all. `--selfcheck` runs a mechanical nearest-neighbour
// separability audit over the finished pack and prints how much of the answer a threshold rule
// could recover; if that number is 1.0 the pack is as easy as round 1's was and should be rejected
// before a judge is spent on it.
//
//   node tools/blind/audio-pack-w1-22-r2.mjs [--seconds 60] [--seed 220722] [--out DIR]
//   node tools/blind/audio-pack-w1-22-r2.mjs --selfcheck DIR      (no browser)

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const USAGE = `audio-pack-w1-22-r2.mjs — the harder blind pack (W1-22 round-2 critic)

  --seconds N     capture length per recording (default 60)
  --rate HZ       sample rate (default 16000)
  --seed N        trial-selection seed (default 220722)
  --out DIR       pack directory (default reports/w1-22-critic/r2/pack)
  --sabotage identical   FALSIFIER: every DIFFERENT pair becomes one recording twice
  --selfcheck DIR NO BROWSER: mechanical separability audit of a finished pack
`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// ---- features ---------------------------------------------------------------------------------
const BANDS = [[60, 150], [150, 400], [400, 1000], [1000, 2500], [2500, 5000], [5000, 7800]];
const FRAME_S = 0.5;

/** One biquad band-pass, direct form I. Enough to split six octave-ish bands. */
function bandpass(x, fs, lo, hi) {
  const f0 = Math.sqrt(lo * hi), bw = hi / lo;
  const w0 = 2 * Math.PI * f0 / fs;
  const alpha = Math.sin(w0) * Math.sinh(Math.LN2 / 2 * Math.log2(bw) * w0 / Math.sin(w0));
  const b0 = alpha, b1 = 0, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w0), a2 = 1 - alpha;
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 / a0) * x[i] + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
const median = (a) => { const b = [...a].sort((p, q) => p - q); return b.length ? b[b.length >> 1] : 0; };
function rms(x, from = 0, to = x.length) { let s = 0; for (let i = from; i < to; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, to - from)); }
const db = (v) => 20 * Math.log10(Math.max(v, 1e-12));

/**
 * THE REPRESENTATION. Everything here is invariant to the clip's loudness AND to its long-term
 * spectrum: each band's frame levels are expressed relative to that band's own median in that
 * clip. A judge holding these numbers knows how the sound MOVES and nothing about what it sounds
 * like. That is the whole point of the pack.
 */
/**
 * DETREND — the second hardening, and it was made AFTER the pack's own falsifier fired, so the
 * reason has to be the item rather than the number, and it is.
 *
 * Referencing each band to the CLIP's median removes the stationary spectrum but leaves the bed's
 * own slow modulation standing: RI-AUD03 §A gives L1 and L2 continuous LFOs (Marauder's Coast's
 * L1 sweeps its filter at 0.061 Hz, its L2 swings gain at 0.11 Hz), and a 60 s clip contains only
 * three or four cycles of those, so they read as a per-region fingerprint that is still the BED.
 * §A's own layer definitions are the dividing line: L1/L2 are *continuous*, L3/L4 are *one-shots*.
 * Referencing every frame to a running median over `DETREND_FRAMES` instead of to the whole clip
 * keeps departures on the timescale of a one-shot and removes wander slower than that. What is
 * left is the layer the B2 judge said was missing, and nothing else.
 */
const DETREND_FRAMES = 21;                                  // 21 x 0.5 s = 10.5 s
function detrend(series) {
  const half = DETREND_FRAMES >> 1;
  return series.map((v, i) => {
    const w = series.slice(Math.max(0, i - half), Math.min(series.length, i + half + 1));
    return +(v - median(w)).toFixed(1);
  });
}

function features(L, R, fs) {
  const mono = new Float64Array(L.length);
  for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) / 2;
  const H = Math.round(fs * FRAME_S);
  const nF = Math.floor(mono.length / H);
  const spectro = [];
  for (const [lo, hi] of BANDS) {
    const y = bandpass(mono, fs, lo, hi);
    const frames = [];
    for (let f = 0; f < nF; f++) frames.push(rms(y, f * H, (f + 1) * H));
    const med = median(frames.filter((v) => v > 0)) || 1e-12;
    spectro.push(detrend(frames.map((v) => +(db(v / med)).toFixed(1))));
  }
  const bb = [];
  for (let f = 0; f < nF; f++) bb.push(rms(mono, f * H, (f + 1) * H));
  const bbMed = median(bb.filter((v) => v > 0)) || 1e-12;
  const level_dev_db = detrend(bb.map((v) => +(db(v / bbMed)).toFixed(1)));
  let pk = 0; for (let i = 0; i < mono.length; i++) pk = Math.max(pk, Math.abs(mono[i]));
  let sxy = 0, sxx = 0, syy = 0, mx = 0, my = 0;
  for (let i = 0; i < L.length; i++) { mx += L[i]; my += R[i]; }
  mx /= L.length; my /= R.length;
  for (let i = 0; i < L.length; i++) { const a = L[i] - mx, b = R[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return {
    frame_s: FRAME_S, frames: nF,
    bands_hz: BANDS.map(([a, b]) => `${a}-${b}`),
    // 6 x nF, dB relative to this clip's own median in that band. Flat by construction.
    band_dev_db: spectro,
    level_dev_db,
    crest_factor_db: +(db(pk) - db(rms(mono))).toFixed(2),
    stereo_correlation: +(sxy / Math.max(1e-12, Math.sqrt(sxx * syy))).toFixed(4),
    // Two detector-free summaries of "does anything happen", so a judge need not trust an onset list.
    level_dev_p95_db: +(([...level_dev_db].sort((a, b) => a - b))[Math.floor(nF * 0.95)]).toFixed(1),
    level_dev_iqr_db: +((([...level_dev_db].sort((a, b) => a - b))[Math.floor(nF * 0.75)])
                       - (([...level_dev_db].sort((a, b) => a - b))[Math.floor(nF * 0.25)])).toFixed(1),
  };
}

// ---- selfcheck (no browser) ---------------------------------------------------------------------
if (args.selfcheck) {
  const dir = String(args.selfcheck);
  const trials = JSON.parse(readFileSync(join(dir, 'trials.json'), 'utf8'));
  const key = JSON.parse(readFileSync(join(dir, '..', 'pack.reveal', 'mapping.json'), 'utf8'));
  // A mechanical rule: distance = mean |A-B| over the two normalised spectrograms + level curve.
  const dist = (a, b) => {
    let s = 0, n = 0;
    for (let k = 0; k < a.band_dev_db.length; k++)
      for (let i = 0; i < Math.min(a.band_dev_db[k].length, b.band_dev_db[k].length); i++) { s += Math.abs(a.band_dev_db[k][i] - b.band_dev_db[k][i]); n++; }
    return n ? s / n : 0;
  };
  const rows = trials.trials.map((t) => ({ id: t.id, d: +dist(t.A, t.B).toFixed(3),
    truth: (key.trials.find((k) => k.id === t.id) || {}).truth }));
  rows.sort((a, b) => a.d - b.d);
  const same = rows.filter((r) => r.truth === 'SAME').map((r) => r.d);
  const diff = rows.filter((r) => r.truth === 'DIFFERENT').map((r) => r.d);
  const maxSame = Math.max(...same), minDiff = Math.min(...diff);
  // best achievable accuracy for ANY single threshold on this statistic
  let best = 0, bestT = null;
  for (const t of rows.map((r) => r.d)) {
    const acc = rows.filter((r) => (r.d < t) === (r.truth === 'SAME')).length / rows.length;
    if (acc > best) { best = acc; bestT = t; }
  }
  console.log(JSON.stringify({ tool: 'audio-pack-w1-22-r2 --selfcheck', dir,
    n: rows.length, same_n: same.length, different_n: diff.length,
    same_distance_range: [Math.min(...same), maxSame], different_distance_range: [minDiff, Math.max(...diff)],
    separable_by_one_threshold: maxSame < minDiff,
    best_single_threshold_accuracy: +best.toFixed(3), best_threshold: bestT,
    verdict: maxSame < minDiff
      ? 'A SINGLE THRESHOLD SOLVES THIS PACK — it is as easy as round 1 and should not be sent to a judge.'
      : 'No single threshold on the spectrogram distance separates the classes; the pack is not solvable by the front end alone.',
  }, null, 2));
  process.exit(0);
}

// ---- build ---------------------------------------------------------------------------------------
const { launchGame } = await import('../lib/browser.mjs');
const SECONDS = Number(args.seconds || 60);
const RATE = Number(args.rate || 16000);
const SEED = Number(args.seed || 220722);
const OUT = args.out ? String(args.out) : join(ROOT, 'reports/w1-22-critic/r2/pack');
const REVEAL = join(dirname(OUT), 'pack.reveal');
const SABOTAGE = args.sabotage ? String(args.sabotage) : null;

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry(SEED);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
function gitStamp() {
  try { const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { commit: sh('git rev-parse --short HEAD'), dirty: sh('git status --porcelain') !== '' }; } catch { return {}; }
}

const handle = await launchGame({ ...args, width: 320, height: 240 });
const page = handle.page;
await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.setRenderRate(0));

// Only the THIRTEEN REGIONS. Interiors are a different question (R4) and mixing them in would let
// a judge separate on "is this a room" rather than on which place it is.
const regionIds = await page.evaluate(() => Object.keys(window.__ENGINE.ambience.beds)
  .filter((id) => { const b = window.__ENGINE.ambience.beds[id]; return !!b.region && !!b.key; }));
const REGIONS = regionIds.slice().sort();
if (REGIONS.length < 10) { console.error(`only ${REGIONS.length} regions found`); await handle.close(); process.exit(2); }

// Two capture seeds per region per tod. A SAME pair is one place at two capture seeds (or at two
// times of day); with the round-3 determinism fix in place the SAME capture seed would be
// bit-identical and the trial would be vacuous.
const SEEDS = [0xa3b1, 0x5c27];
const recordings = {};                                   // recId -> {features, provenance}
let n = 0;
for (const region of REGIONS) {
  for (const tod of ['day', 'night']) {
    for (const s of SEEDS) {
      // BASE64 16-bit PCM, not `arrays: true`. `Engine.ambienceCapture`'s own note says handing a
      // minute of stereo across the CDP bridge as JSON doubles "turned a thirteen-region render
      // into a ten-minute job on a loaded box"; this pack is 52 recordings. Decoded in Node below,
      // so no number here is one the engine computed about itself.
      const cap = await page.evaluate(async (o) => {
        const c = await window.__ENGINE.ambienceCapture({ region: o.region, seconds: o.seconds,
          sampleRate: o.rate, tod: o.tod, seed: o.seed });
        return c.ok ? { b64: c.pcm16_interleaved_b64, sampleRate: c.sampleRate, samples: c.samples }
                    : { ok: false, why: c.why };
      }, { region, tod, seconds: SECONDS, rate: RATE, seed: s });
      if (!cap.b64) { console.error(`capture failed ${region}/${tod}/${s}: ${cap.why}`); continue; }
      const raw = Buffer.from(cap.b64, 'base64');
      const nS = raw.length >> 2;                       // 2 channels x 2 bytes
      const L = new Float64Array(nS), R = new Float64Array(nS);
      for (let i = 0; i < nS; i++) { L[i] = raw.readInt16LE(i * 4) / 32767; R[i] = raw.readInt16LE(i * 4 + 2) / 32767; }
      const id = `R${String(++n).padStart(3, '0')}`;
      recordings[id] = { id, provenance: { region, tod, capture_seed: s },
                         f: features(L, R, cap.sampleRate) };
    }
  }
}
await handle.close();

const recOf = (region, tod, si) => Object.values(recordings)
  .find((r) => r.provenance.region === region && r.provenance.tod === tod && r.provenance.capture_seed === SEEDS[si]);

// ---- strata ------------------------------------------------------------------------------------
const pairs = [];
// SAME — one place, two capture seeds, same time of day.
for (const region of shuffle(REGIONS).slice(0, 8))
  pairs.push({ truth: 'SAME', stratum: 'reroll', a: recOf(region, 'day', 0), b: recOf(region, 'day', 1) });
// SAME — one place, day against night. R5's trap: a correct build makes these LOOK different.
for (const region of shuffle(REGIONS).slice(0, 5))
  pairs.push({ truth: 'SAME', stratum: 'tod', a: recOf(region, 'day', 0), b: recOf(region, 'night', 1) });
// DIFFERENT — two places, spectrum removed. All from distinct region pairs.
const seen = new Set();
const cand = [];
for (let i = 0; i < REGIONS.length; i++) for (let j = i + 1; j < REGIONS.length; j++) cand.push([REGIONS[i], REGIONS[j]]);
for (const [x, y] of shuffle(cand)) {
  if (pairs.filter((p) => p.truth === 'DIFFERENT').length >= 13) break;
  const k = `${x}|${y}`; if (seen.has(k)) continue; seen.add(k);
  const tod = rnd() < 0.5 ? 'day' : 'night';
  pairs.push({ truth: 'DIFFERENT', stratum: 'cross', a: recOf(x, tod, 0), b: recOf(y, tod, 1) });
}
const trials = shuffle(pairs).filter((p) => p.a && p.b).map((p, i) => ({ ...p, id: `T${String(i + 1).padStart(2, '0')}` }));

mkdirSync(OUT, { recursive: true });
mkdirSync(REVEAL, { recursive: true });

const trialsJson = {
  pack: 'w1-22-r2-hard', built_at: new Date().toISOString(), git: gitStamp(),
  representation: {
    what: 'Each recording is 60 seconds of one place, reduced to how it MOVES. Loudness and '
      + 'long-term tone colour have both been removed: every band level is a deviation in dB from '
      + 'that recording\'s own median level in that band, so the average spectrum of every '
      + 'recording here is flat and identical and carries no information.',
    fields: {
      band_dev_db: '6 bands x N frames, dB relative to this recording\'s own median in that band.',
      level_dev_db: 'broadband frame level, dB relative to this recording\'s own median frame.',
      crest_factor_db: 'peak over RMS of the whole recording.',
      stereo_correlation: '1.0 = mono, 0.0 = fully decorrelated.',
      level_dev_p95_db: '95th percentile of level_dev_db.',
      level_dev_iqr_db: 'interquartile range of level_dev_db.',
    },
  },
  trials: trials.map((t) => ({
    id: t.id,
    A: SABOTAGE === 'identical' && t.truth === 'DIFFERENT' ? t.a.f : t.a.f,
    B: SABOTAGE === 'identical' && t.truth === 'DIFFERENT' ? t.a.f : t.b.f,
  })),
};
const trialsPath = join(OUT, 'trials.json');
writeFileSync(trialsPath, JSON.stringify(trialsJson, null, 1));
// HASH THE BYTES ON DISK, after the last write. Round 1's pack declared a hash of a file it then
// edited; this cannot.
const trialsSha = createHash('sha256').update(readFileSync(trialsPath)).digest('hex');

writeFileSync(join(OUT, 'PROMPT.md'), `# Blind listening pack — same place or different places?

You are given ${trials.length} trials. Each trial has two recordings, \`A\` and \`B\`, each of
${SECONDS} seconds of ambient sound from a place in a game world.

**For each trial answer SAME (both recordings are the same place) or DIFFERENT (two different
places), and give one sentence of reason citing at least one number.**

You are not told how many of each there are, and you must answer every trial. Do not hedge, do not
decline, do not leave a trial blank. Guess when unsure and say that you guessed.

## What you are given, and what has been taken away

You have no audio. Each recording is described by measurements only:

| field | meaning |
|---|---|
| \`band_dev_db\` | six frequency bands x ${Math.round(SECONDS / FRAME_S)} frames of ${FRAME_S} s. Each number is that band's level in that half-second, in dB, **relative to a running median over the surrounding 10.5 seconds**. A positive number means that band was louder in that half-second than it was just before and just after it. |
| \`level_dev_db\` | the same, broadband: each frame against its own 10.5 s running median. |
| \`crest_factor_db\` | peak over RMS across the whole recording. |
| \`stereo_correlation\` | 1.0 = both channels identical (no stereo image), 0.0 = fully decorrelated (wide). |
| \`level_dev_p95_db\`, \`level_dev_iqr_db\` | summary spread of \`level_dev_db\`. |

**Three things have deliberately been removed.** Loudness — every recording is level-normalised.
**Tone colour** — every band is expressed relative to its own level, so the long-term average
spectrum of every recording in this pack is flat and identical; you cannot tell a deep rumble from
a bright hiss here, and you are not meant to be able to. And **slow drift** — anything that varies
more slowly than about ten seconds has been subtracted out, so a steady hum with a slow sweep on it
reads as a flat line.

What is left is **when things happen, how far above the floor they get, how often, in which bands,
and how wide the recording sits in stereo.** A recording where nothing happens is a field of zeros.

A trial where both recordings are the same place may still be two different recordings of it: a
different roll of the random number generator, or the same place at a different time of day. Those
are still SAME — it is one place.

## Answer format

Write \`answer.md\` in this directory, one line per trial, before you look at anything else:

\`\`\`
T01 SAME | one sentence, citing a number
T02 DIFFERENT | one sentence, citing a number
...
\`\`\`

Then a final section:

\`\`\`
## WEAKEST POINT
<the strongest argument against your own answers>
\`\`\`
`);

writeFileSync(join(OUT, 'pack.json'), JSON.stringify({
  pack: 'w1-22-r2-hard', trials: trials.length, seconds: SECONDS, sample_rate: RATE,
  selection_seed: SEED, git: trialsJson.git, built_at: trialsJson.built_at,
  trials_sha256: trialsSha,
  note: 'trials_sha256 is computed from the bytes of trials.json AFTER its final write.',
}, null, 2));

writeFileSync(join(REVEAL, 'mapping.json'), JSON.stringify({
  pack: 'w1-22-r2-hard', trials_sha256: trialsSha,
  strata: { reroll: 'SAME, one region, two capture seeds, same tod',
            tod: 'SAME, one region, day vs night (RI-AUD03 R5)',
            cross: 'DIFFERENT, two regions' },
  trials: trials.map((t) => ({ id: t.id, truth: t.truth, stratum: t.stratum,
    a: t.a.provenance, b: t.b.provenance })),
}, null, 2));

writeFileSync(join(REVEAL, 'OPERATOR.md'), `# Operator notes — NOT for the judge, and not in the pack directory

This file is in the reveal sibling because the round-1 pack put its equivalent (\`JUDGE.md\`) inside
the pack directory, where it disclosed the class balance while \`PROMPT.md\` promised the judge was
not told it. The round-1 blind judge found that and recorded it as leak 1 of 3.

* Pack: \`${OUT}\`  Reveal: \`${REVEAL}\`
* \`trials.json\` sha256: \`${trialsSha}\`
* Scoring: \`separation\` = correctly answered DIFFERENT / all DIFFERENT.
  \`false_different_rate\` = SAME answered DIFFERENT / all SAME.
* **This is not RI-AUD03 B2.** Tone colour is withheld on purpose, and tone colour is a legitimate
  discriminator for a listener. The result is a lower bound and a diagnosis: does anything besides
  the colour of the hum separate these places?
* The \`tod\` stratum is SAME by truth. RI-AUD03 R5 requires night to be a different L2/L4
  selection, so a correct build makes those pairs look unalike while being one place.
`);

console.log(`pack built: ${trials.length} trials, ${Object.keys(recordings).length} recordings, ${REGIONS.length} regions`);
console.log(`pack:   ${OUT}`);
console.log(`reveal: ${REVEAL}`);
console.log(`trials.json sha256: ${trialsSha}`);
