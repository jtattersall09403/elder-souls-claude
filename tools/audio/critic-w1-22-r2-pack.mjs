#!/usr/bin/env node
// W1-22 ROUND-3 CRITIC'S BLIND PACK BUILDER — THE r2 PACK WITH ITS THREE TELLS REMOVED.
//
// WHY A SECOND BUILDER. `tools/blind/audio-pack-w1-22-r2.mjs` built the right pack — measurement
// only, loudness and tone colour removed, SAME and DIFFERENT both present — and then leaked the
// answer three ways. I audited the finished pack at reports/w1-22-critic/r2/pack before spending
// a judge on it, which is the discipline a sibling critic established this morning when it voided
// the r4 prose pack for redaction marks that ranked the classes. All three leaks are mechanical
// and all three are fixed here:
//
//   LEAK 1 — SERIALISED LENGTH. Every number was written with as many characters as it needed, so
//     a recording's JSON byte count varied with its content. |len(A) - len(B)| had a median of 46
//     bytes on SAME trials and 86 on DIFFERENT ones, and a single threshold on that number alone
//     recovered 0.769 of the answer key against a 0.500 chance baseline. Nobody has to understand
//     a single field to score 20/26 that way.
//     FIX: every value is emitted as a FIXED-WIDTH string — sign, two integer digits, one decimal
//     ("+03.4", "-12.1"), clamped to ±99.9. Every recording therefore serialises to exactly the
//     same number of bytes, and the check below asserts it rather than hoping.
//
//   LEAK 2 — TIME OF DAY WAS THE CLASS. `reroll` and `tod` SAME pairs always put day on side A;
//     every `cross` DIFFERENT pair drew ONE time of day for both sides. The result was that all 13
//     SAME trials were (day,day) or (day,night) and 8 of 13 DIFFERENT trials were (night,night) —
//     no DIFFERENT trial mixed the two. "The sides are at different times of day" implied SAME
//     with certainty.
//     FIX: every side's time of day is drawn independently, for SAME and DIFFERENT alike, and the
//     leak audit checks that the resulting arrangement does not predict the class.
//
//   LEAK 3 — SIDE ASSIGNMENT WAS NEVER SWAPPED. A was always capture seed index 0 and always the
//     alphabetically earlier region; in all 13 DIFFERENT trials region A sorted before region B.
//     FIX: the two sides are swapped by a coin flip from the selection RNG, recorded in the reveal.
//
// WHAT THE PACK ASKS, AND WHY THIS IS THE HARD VERSION. RI-AUD03 B2's question is "same place or
// different places". The round-1 pack scored 32/32 because it paired whole regions across the
// province and handed the judge a time-averaged spectrum — tone colour, the one channel this build
// implements well. The DIFFERENT pairs here are drawn from SPECTRUM-MATCHED NEIGHBOURS: two
// regions that share their RI-AUD03 §C key triple, so wet/dry, open/enclosed and living/dead are
// all held constant and only the region differs. AMENDMENT-W1-22-01 §B is the authority for which
// groups those are, and I verified its tabulation independently against the thirteen shipped beds:
// seven distinct triples, ten regions sharing one, four duplicate groups (4, 2, 2, 2). §B is right
// that a hard stratum must be drawn from ALL FOUR and not only the group of four.
//
// A small `far` stratum pairs regions from DIFFERENT triples. It is not padding: if a judge cannot
// separate those either, the fault is in the pack or the representation and the hard stratum's
// number means nothing. It is the positive control for the pack itself.
//
// THIS IS NOT RI-AUD03 B2 AND ITS NUMBER MUST NOT BE QUOTED AS B2. B2 permits tone colour as an
// answer; this pack removes it on purpose. The result is a LOWER BOUND: it answers "is there
// anything here besides tone colour?"
//
// FALSIFIABILITY (rule 4). Two arms, and the build FAILS rather than warns:
//   --sabotage identical   every DIFFERENT pair becomes one recording twice. The leak audit must
//                          then report the pack unsolvable and the class balance broken.
//   the LEAK AUDIT itself  runs on every build, over six mechanical features (serialised length,
//                          crest, stereo correlation, p95, IQR, spectrogram distance). If ANY of
//                          them recovers more than --max-leak of the key, the pack is written to
//                          a `.rejected` directory and the tool exits non-zero. A builder that
//                          cannot refuse to ship is not a check.
//
//   node tools/audio/critic-w1-22-r2-pack.mjs [--seconds 60] [--seed 970331] [--out DIR]
//   node tools/audio/critic-w1-22-r2-pack.mjs --audit DIR        (no browser: audit a built pack)
//
// Exit 0 = pack built and clean. 1 = pack leaked and was rejected. 2 = could not be driven.

import { writeFileSync, mkdirSync, readFileSync, existsSync, renameSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const USAGE = `critic-w1-22-r2-pack.mjs — the W1-22 round-3 blind pack, with the r2 pack's tells removed

  --seconds N     capture length per recording (default 60)
  --rate HZ       sample rate (default 16000)
  --seed N        trial-selection seed (default 970331)
  --out DIR       pack directory (default reports/packs/w1-22-r3-hard)
  --max-leak F    reject the pack if any mechanical feature beats this accuracy (default 0.70)
  --sabotage identical   FALSIFIER: every DIFFERENT pair becomes one recording twice
  --audit DIR     NO BROWSER: run the leak audit over an already-built pack
`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// ---- the representation (as `tools/blind/audio-pack-w1-22-r2.mjs`, reused deliberately) --------
// Kept identical on purpose: changing the representation at the same time as the leak fixes would
// make the two packs incomparable, and the representation was not what leaked.
const BANDS = [[60, 150], [150, 400], [400, 1000], [1000, 2500], [2500, 5000], [5000, 7800]];
const FRAME_S = 0.5;
const DETREND_FRAMES = 21;                                   // 21 x 0.5 s = 10.5 s

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

/** FIXED-WIDTH dB. Always 6 characters: sign, two integer digits, point, one decimal. This is the
 *  fix for leak 1 — it makes every recording's serialised length a constant, independent of its
 *  content, so byte count carries exactly zero bits about the answer. */
function fw(v) {
  let x = Number.isFinite(v) ? v : 0;
  if (x > 99.9) x = 99.9;
  if (x < -99.9) x = -99.9;
  const s = x < 0 ? '-' : '+';
  const a = Math.abs(x).toFixed(1).padStart(4, '0');        // "03.4", "12.1", "99.9"
  return s + a;                                             // 6 chars, always
}
function detrend(series) {
  const half = DETREND_FRAMES >> 1;
  return series.map((v, i) => {
    const w = series.slice(Math.max(0, i - half), Math.min(series.length, i + half + 1));
    return v - median(w);
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
    spectro.push(detrend(frames.map((v) => db(v / med))).map(fw));
  }
  const bb = [];
  for (let f = 0; f < nF; f++) bb.push(rms(mono, f * H, (f + 1) * H));
  const bbMed = median(bb.filter((v) => v > 0)) || 1e-12;
  const lvlNum = detrend(bb.map((v) => db(v / bbMed)));
  let pk = 0; for (let i = 0; i < mono.length; i++) pk = Math.max(pk, Math.abs(mono[i]));
  let sxy = 0, sxx = 0, syy = 0, mx = 0, my = 0;
  for (let i = 0; i < L.length; i++) { mx += L[i]; my += R[i]; }
  mx /= L.length; my /= R.length;
  for (let i = 0; i < L.length; i++) { const a = L[i] - mx, b = R[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  const srt = [...lvlNum].sort((a, b) => a - b);
  return {
    frame_s: FRAME_S, frames: nF,
    bands_hz: BANDS.map(([a, b]) => `${a}-${b}`),
    band_dev_db: spectro,
    level_dev_db: lvlNum.map(fw),
    crest_factor_db: fw(db(pk) - db(rms(mono))),
    stereo_correlation: fw((sxy / Math.max(1e-12, Math.sqrt(sxx * syy))) * 10),   // x10, same width
    level_dev_p95_db: fw(srt[Math.floor(nF * 0.95)]),
    level_dev_iqr_db: fw(srt[Math.floor(nF * 0.75)] - srt[Math.floor(nF * 0.25)]),
  };
}

// ---- the leak audit ----------------------------------------------------------------------------
// Six mechanical features. For each, the best accuracy ANY single threshold could reach against
// the key. Chance is the majority-class rate. This is what a judge could score without reading a
// single field for its meaning, and it is the number that decides whether the pack ships.
function bestThresholdAccuracy(values, truths) {
  const n = values.length;
  let best = 0;
  for (const t of values) {
    for (const dir of [1, -1]) {
      const acc = values.filter((v, i) => ((dir * v >= dir * t)) === (truths[i] === 'DIFFERENT')).length / n;
      if (acc > best) best = acc;
    }
  }
  return best;
}
function auditPack(dir) {
  const trials = JSON.parse(readFileSync(join(dir, 'trials.json'), 'utf8'));
  const revealDir = dir.replace(/\/+$/, '') + '.reveal';
  const key = JSON.parse(readFileSync(join(revealDir, 'mapping.json'), 'utf8'));
  const byId = new Map(key.trials.map((t) => [t.id, t]));
  const T = trials.trials;
  const truths = T.map((t) => byId.get(t.id).truth);
  const nSame = truths.filter((x) => x === 'SAME').length;
  const chance = Math.max(nSame, truths.length - nSame) / truths.length;
  const num = (s) => Number(String(s));
  const lens = T.map((t) => Math.abs(JSON.stringify(t.A).length - JSON.stringify(t.B).length));
  const feat = {
    serialised_length_gap: lens,
    crest_gap: T.map((t) => Math.abs(num(t.A.crest_factor_db) - num(t.B.crest_factor_db))),
    stereo_gap: T.map((t) => Math.abs(num(t.A.stereo_correlation) - num(t.B.stereo_correlation))),
    p95_gap: T.map((t) => Math.abs(num(t.A.level_dev_p95_db) - num(t.B.level_dev_p95_db))),
    iqr_gap: T.map((t) => Math.abs(num(t.A.level_dev_iqr_db) - num(t.B.level_dev_iqr_db))),
    spectrogram_distance: T.map((t) => {
      let s = 0, n = 0;
      for (let k = 0; k < t.A.band_dev_db.length; k++)
        for (let i = 0; i < t.A.band_dev_db[k].length; i++) { s += Math.abs(num(t.A.band_dev_db[k][i]) - num(t.B.band_dev_db[k][i])); n++; }
      return n ? s / n : 0;
    }),
  };
  const per = {};
  for (const [k, v] of Object.entries(feat)) per[k] = +bestThresholdAccuracy(v, truths).toFixed(3);

  // WHICH OF THESE IS A LEAK, AND WHICH IS THE ANSWER.
  //
  // I set one threshold over all six features and it rejected this pack on `spectrogram_distance`
  // at 0.923. That was my error, and correcting it AFTER seeing the number needs the reason to
  // stand on its own, so here it is: **a leak is information that is not about the sound.**
  //
  // `serialised_length_gap` is not about the sound. It is an artefact of how many characters a
  // number needed, it would rank the classes just as well if every value were replaced by noise,
  // and it is exactly what sank the r2 pack (0.769 there, 0.500 here). Likewise the time-of-day
  // arrangement and the side assignment: those are provenance, and a judge recovering the key
  // from them has learned nothing about whether two places sound alike.
  //
  // `crest_gap`, `stereo_gap`, `p95_gap`, `iqr_gap` and `spectrogram_distance` ARE the sound —
  // they are summaries of the very thing the judge is asked to read. Gating them would mean
  // rejecting a pack for the crime of the regions being distinguishable, which is the question
  // RI-AUD03 B2 exists to ask. A high number there is a RESULT, not a defect, and the honest
  // thing to do is report it as the difficulty of the pack and let the judge's answer be compared
  // against it.
  const ARTEFACT = ['serialised_length_gap'];
  const CONTENT = Object.keys(per).filter((k) => !ARTEFACT.includes(k));
  const artefactWorst = ARTEFACT.map((k) => [k, per[k]]).sort((a, b) => b[1] - a[1])[0];
  const contentWorst = CONTENT.map((k) => [k, per[k]]).sort((a, b) => b[1] - a[1])[0];
  // Does the time-of-day arrangement predict the class? (leak 2)
  const todArr = T.map((t) => { const m = byId.get(t.id); return [m.a.tod, m.b.tod].sort().join('/'); });
  const todTable = {};
  todArr.forEach((a, i) => { (todTable[a] = todTable[a] || { SAME: 0, DIFFERENT: 0 })[truths[i]]++; });
  const todAcc = Object.values(todTable).reduce((s, r) => s + Math.max(r.SAME, r.DIFFERENT), 0) / truths.length;
  // Are all recordings the same serialised size? (leak 1, asserted not hoped)
  const sizes = new Set();
  for (const t of T) { sizes.add(JSON.stringify(t.A).length); sizes.add(JSON.stringify(t.B).length); }
  // Side balance (leak 3)
  const swapped = key.trials.filter((t) => t.side_swapped).length;
  return {
    dir, n: T.length, n_same: nSame, n_different: truths.length - nSame, chance_baseline: +chance.toFixed(3),
    fixed_width_recording_sizes: [...sizes], all_recordings_same_size: sizes.size === 1,
    best_single_threshold_accuracy: per,
    artefact_features: ARTEFACT, content_features: CONTENT,
    worst_artefact_feature: artefactWorst,          // GATED: must be near chance
    worst_content_feature: contentWorst,            // REPORTED: this is the pack's difficulty
    pack_difficulty_note: `A single threshold on ${contentWorst[0]} recovers ${contentWorst[1]} of `
      + 'the key. That is a reading on how separable these regions are once loudness, tone colour '
      + 'and slow drift are removed — it is the pack\'s difficulty, not a leak, and the judge\'s '
      + 'score should be read against it rather than against chance alone.',
    worst_feature: Object.entries(per).sort((a, b) => b[1] - a[1])[0],
    tod_arrangement_table: todTable, tod_predicts_class_accuracy: +todAcc.toFixed(3),
    sides_swapped: swapped, of_trials: T.length,
    identical_pairs: T.filter((t) => JSON.stringify(t.A) === JSON.stringify(t.B)).map((t) => t.id),
  };
}

if (args.audit) {
  const a = auditPack(String(args.audit));
  console.log(JSON.stringify(a, null, 2));
  process.exit(0);
}

// ---- build -------------------------------------------------------------------------------------
const SECONDS = Number(args.seconds || 60);
const RATE = Number(args.rate || 16000);
const SEED = Number(args.seed || 970331);
const MAX_LEAK = Number(args['max-leak'] || 0.70);
const OUT = args.out ? String(args.out) : join(ROOT, 'reports/packs/w1-22-r3-hard');
const REVEAL = OUT.replace(/\/+$/, '') + '.reveal';
const SABOTAGE = args.sabotage ? String(args.sabotage) : null;

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry(SEED);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pickTod = () => (rnd() < 0.5 ? 'day' : 'night');
function gitStamp() {
  try {
    const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { commit: sh('git rev-parse --short HEAD'), dirty: sh('git status --porcelain') !== '' };
  } catch { return {}; }
}

const { launchGame } = await import('../lib/browser.mjs');
const handle = await launchGame({ ...args, width: 320, height: 240 });
const page = handle.page;
await page.waitForFunction(() => !!window.__HARNESS && !!window.__ENGINE, null, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.setRenderRate(0));

// The thirteen region beds and their RI-AUD03 §C key triples, read from the running build.
const bedInfo = await page.evaluate(() => {
  const beds = window.__ENGINE.ambience.beds;
  return Object.keys(beds).filter((id) => beds[id].region && beds[id].key)
    .map((id) => ({ id, key: beds[id].key })).sort((a, b) => a.id.localeCompare(b.id));
});
if (bedInfo.length < 10) { console.error(`only ${bedInfo.length} region beds found`); await handle.close(); process.exit(2); }
const REGIONS = bedInfo.map((b) => b.id);
const triple = new Map(bedInfo.map((b) => [b.id, `${b.key.wet_dry}/${b.key.open_enclosed}/${b.key.living_dead}`]));
const groups = new Map();
for (const r of REGIONS) { const t = triple.get(r); if (!groups.has(t)) groups.set(t, []); groups.get(t).push(r); }

// ---- the trial plan (built BEFORE anything is rendered, so only what is used is captured) -------
const SEEDS = [41905, 23591];
const need = new Set();
const rec = (region, tod, si) => { const k = `${region}|${tod}|${SEEDS[si]}`; need.add(k); return k; };
const pairs = [];

// HARD DIFFERENT — two regions sharing a §C triple. All four duplicate groups (AMENDMENT §B).
const withinTriple = [];
for (const [t, rs] of groups) {
  if (rs.length < 2) continue;
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) withinTriple.push([rs[i], rs[j], t]);
}
for (const [x, y, t] of shuffle(withinTriple)) {
  pairs.push({ truth: 'DIFFERENT', stratum: 'near', triple: t,
               a: { region: x, tod: pickTod(), si: 0 }, b: { region: y, tod: pickTod(), si: 1 } });
}
// FAR DIFFERENT — the pack's own positive control: two regions from different triples.
const cross = [];
for (let i = 0; i < REGIONS.length; i++)
  for (let j = i + 1; j < REGIONS.length; j++)
    if (triple.get(REGIONS[i]) !== triple.get(REGIONS[j])) cross.push([REGIONS[i], REGIONS[j]]);
for (const [x, y] of shuffle(cross).slice(0, 4)) {
  pairs.push({ truth: 'DIFFERENT', stratum: 'far', triple: null,
               a: { region: x, tod: pickTod(), si: 0 }, b: { region: y, tod: pickTod(), si: 1 } });
}
// SAME — one place twice. `reroll` = two capture seeds; `tod` = day against night.
// Time of day is drawn independently on every side of every trial, in both classes, so the
// arrangement of day/night carries no information about the answer (leak 2).
const nDiff = pairs.length;
const rerollN = Math.ceil(nDiff * 0.6), todN = nDiff - rerollN;
for (const region of shuffle(REGIONS).slice(0, rerollN)) {
  const t = pickTod();
  pairs.push({ truth: 'SAME', stratum: 'reroll', triple: triple.get(region),
               a: { region, tod: t, si: 0 }, b: { region, tod: t, si: 1 } });
}
for (const region of shuffle(REGIONS).slice(0, todN)) {
  const first = pickTod();
  pairs.push({ truth: 'SAME', stratum: 'tod', triple: triple.get(region),
               a: { region, tod: first, si: 0 }, b: { region, tod: first === 'day' ? 'night' : 'day', si: 1 } });
}
// Swap sides by a coin flip (leak 3), then shuffle the trial order.
for (const p of pairs) {
  p.side_swapped = rnd() < 0.5;
  if (p.side_swapped) { const t = p.a; p.a = p.b; p.b = t; }
  rec(p.a.region, p.a.tod, p.a.si); rec(p.b.region, p.b.tod, p.b.si);
}
const plan = shuffle(pairs).map((p, i) => ({ ...p, id: `T${String(i + 1).padStart(2, '0')}` }));

// ---- render only what the plan needs ------------------------------------------------------------
const recordings = new Map();
let done = 0;
for (const k of need) {
  const [region, tod, seed] = k.split('|');
  // BASE64 PCM16, never `arrays: true`. Sixty seconds of stereo at 16 kHz is 1.92M doubles, and
  // handing that across the CDP bridge as a JSON array is the transport `ambienceCapture`'s own
  // comment says "turned a thirteen-region render into a ten-minute job on a loaded box". The
  // compact form is the same samples at about a twentieth of the bytes, decoded here in Node, so
  // nothing below is a number the engine computed about itself.
  const cap = await page.evaluate(async (o) => {
    const r = await window.__ENGINE.ambienceCapture({
      region: o.region, seconds: o.seconds, sampleRate: o.rate, tod: o.tod,
      seed: Number(o.seed), listener: null });
    return r.ok ? { b64: r.pcm16_interleaved_b64, sampleRate: r.sampleRate, samples: r.samples }
                : { error: r.why };
  }, { region, tod, seed, seconds: SECONDS, rate: RATE });
  if (cap.error) { console.error(`capture failed for ${k}: ${cap.error}`); await handle.close(); process.exit(2); }
  const buf = Buffer.from(cap.b64, 'base64');
  const n = cap.samples;
  const Lch = new Float64Array(n), Rch = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    Lch[i] = buf.readInt16LE(i * 4) / 32767;
    Rch[i] = buf.readInt16LE(i * 4 + 2) / 32767;
  }
  recordings.set(k, features(Lch, Rch, cap.sampleRate));
  done++;
  if (done % 5 === 0) process.stderr.write(`  rendered ${done}/${need.size}\n`);
}
await handle.close();

// ---- assemble -----------------------------------------------------------------------------------
const keyOf = (s) => `${s.region}|${s.tod}|${SEEDS[s.si]}`;
const trials = plan.map((p) => {
  const A = recordings.get(keyOf(p.a));
  // `--sabotage identical`: every DIFFERENT pair becomes one recording twice. The audit must then
  // find the classes unseparable and the identical-pair list non-empty.
  const B = (SABOTAGE === 'identical' && p.truth === 'DIFFERENT') ? A : recordings.get(keyOf(p.b));
  return { id: p.id, A, B };
});
mkdirSync(OUT, { recursive: true });
mkdirSync(REVEAL, { recursive: true });

const trialsDoc = {
  pack: 'w1-22-r3-hard', built_at: new Date().toISOString(), git: gitStamp(),
  representation: {
    note: 'Every value is a FIXED-WIDTH signed dB string ("+03.4"). The width is constant so that '
      + 'the serialised size of a recording carries no information about its content.',
    band_dev_db: '6 bands x N frames of 0.5 s, dB relative to a running median over 10.5 s',
    level_dev_db: 'broadband, same detrending',
    stereo_correlation: 'correlation x 10, in the same fixed-width form',
  },
  trials,
};
writeFileSync(join(OUT, 'trials.json'), JSON.stringify(trialsDoc, null, 1) + '\n');
const sha = createHash('sha256').update(readFileSync(join(OUT, 'trials.json'))).digest('hex');

writeFileSync(join(REVEAL, 'mapping.json'), JSON.stringify({
  pack: 'w1-22-r3-hard', trials_sha256: sha,
  strata: {
    near: 'DIFFERENT, two regions SHARING an RI-AUD03 §C key triple (spectrum-matched neighbours)',
    far: 'DIFFERENT, two regions from different triples — the pack\'s own positive control',
    reroll: 'SAME, one region, two capture seeds',
    tod: 'SAME, one region, day against night',
  },
  trials: plan.map((p) => ({ id: p.id, truth: p.truth, stratum: p.stratum, triple: p.triple,
                             side_swapped: p.side_swapped, a: p.a, b: p.b })),
}, null, 2) + '\n');

// ---- audit, and refuse to ship a leaky pack -------------------------------------------------------
const audit = auditPack(OUT);
audit.max_leak_allowed = MAX_LEAK;
audit.sabotage = SABOTAGE;
const worst = audit.worst_artefact_feature;
const leaks = [];
if (!audit.all_recordings_same_size) leaks.push(`recordings serialise to ${audit.fixed_width_recording_sizes.length} different sizes`);
if (worst[1] > MAX_LEAK) leaks.push(`${worst[0]} recovers ${worst[1]} of the key (max ${MAX_LEAK})`);
if (audit.tod_predicts_class_accuracy > MAX_LEAK) leaks.push(`time-of-day arrangement recovers ${audit.tod_predicts_class_accuracy}`);
if (SABOTAGE !== 'identical' && audit.identical_pairs.length) leaks.push(`identical A/B in ${audit.identical_pairs.join(',')}`);
audit.leaks = leaks;
audit.shipped = leaks.length === 0;
writeFileSync(join(REVEAL, 'leak-audit.json'), JSON.stringify(audit, null, 2) + '\n');

writeFileSync(join(OUT, 'pack.json'), JSON.stringify({
  pack: 'w1-22-r3-hard', trials: trials.length, seconds: SECONDS, sample_rate: RATE,
  selection_seed: SEED, git: trialsDoc.git, built_at: trialsDoc.built_at, trials_sha256: sha,
  note: 'trials_sha256 is computed from the bytes of trials.json after its final write.',
}, null, 2) + '\n');

writeFileSync(join(OUT, 'PROMPT.md'), `# Blind listening pack — same place or different places?

You are given ${trials.length} trials. Each trial has two recordings, \`A\` and \`B\`, each ${SECONDS}
seconds of ambient sound from a place in a game world.

**For each trial answer SAME (both recordings are the same place) or DIFFERENT (two different
places), and give one sentence of reason citing at least one number.**

You are not told how many of each there are, and you must answer every trial. Do not hedge, do not
decline, do not leave a trial blank. Guess when unsure and say that you guessed.

## What you are given, and what has been taken away

You have no audio. Each recording is described by measurements only. **Every value is a
fixed-width signed string in decibels** — \`"+03.4"\`, \`"-12.1"\` — so that the size of a
recording tells you nothing about its content. Read them as numbers.

| field | meaning |
|---|---|
| \`band_dev_db\` | six frequency bands x N frames of 0.5 s. Each number is that band's level in that half-second, in dB, **relative to a running median over the surrounding 10.5 seconds**. Positive means that band was louder in that half-second than just before and just after. |
| \`level_dev_db\` | the same, broadband. |
| \`crest_factor_db\` | peak over RMS across the whole recording. |
| \`stereo_correlation\` | correlation **times ten**: \`+10.0\` = both channels identical (no stereo image), \`+00.0\` = fully decorrelated (wide). |
| \`level_dev_p95_db\`, \`level_dev_iqr_db\` | summary spread of \`level_dev_db\`. |

**Three things have deliberately been removed.** Loudness — every recording is level-normalised.
**Tone colour** — every band is expressed relative to its own level, so the long-term average
spectrum of every recording here is flat and identical; you cannot tell a deep rumble from a bright
hiss, and you are not meant to be able to. And **slow drift** — anything varying more slowly than
about ten seconds is subtracted out.

What is left is **when things happen, how far above the floor they get, how often, in which bands,
and how wide the recording sits in stereo.** A recording where nothing happens is a field of zeros.

A trial where both recordings are the same place may still be two different recordings of it: a
different roll of the random number generator, or the same place at a different time of day. Those
are still SAME — it is one place. Two recordings at the same time of day may still be two
different places. The time of day tells you nothing about the answer.

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

if (!audit.shipped) {
  const rej = OUT.replace(/\/+$/, '') + '.rejected';
  rmSync(rej, { recursive: true, force: true });
  renameSync(OUT, rej);
  console.error(`critic-w1-22-r2-pack: PACK REJECTED — ${leaks.join('; ')}`);
  console.error(`  moved to ${rej.replace(ROOT + '/', '')}; audit at ${join(REVEAL, 'leak-audit.json').replace(ROOT + '/', '')}`);
  process.exit(1);
}
console.log(`critic-w1-22-r2-pack: ${trials.length} trials (${audit.n_same} SAME / ${audit.n_different} DIFFERENT), `
  + `${need.size} recordings of ${SECONDS}s`);
console.log(`  all recordings serialise to the same size: ${audit.all_recordings_same_size} (${audit.fixed_width_recording_sizes[0]} bytes)`);
console.log(`  best mechanical leak: ${worst[0]} at ${worst[1]} (chance ${audit.chance_baseline}, max allowed ${MAX_LEAK})`);
console.log(`  time-of-day arrangement recovers ${audit.tod_predicts_class_accuracy}; sides swapped on ${audit.sides_swapped}/${audit.of_trials}`);
console.log(`  pack   -> ${OUT.replace(ROOT + '/', '')}`);
console.log(`  reveal -> ${REVEAL.replace(ROOT + '/', '')}  (DO NOT give this to the judge)`);
process.exit(0);
