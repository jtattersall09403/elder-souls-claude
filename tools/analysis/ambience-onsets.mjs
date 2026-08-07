#!/usr/bin/env node
// DOES ANYTHING ACTUALLY HAPPEN? W1-22 round 2, `audio.ambience.region`. Spec: RI-AUD03 §A.
//
// WHY THIS TOOL EXISTS. The RI-AUD03 B2 blind judge — fresh, quarantined, and answering a pack
// this piece did not build — returned 32/32 separation and then said the thing that mattered:
//
//     "Every region in this game sounds clearly different from every other one — and nothing
//      ever happens in any of them. Across all 64 recordings in the pack, 21 minutes and 20
//      seconds of ambience, the pack's onset detector found ZERO discrete sound events. Not one
//      bird, drip, gust or creak."
//
// and corroborated it with a statistic that does not depend on its own detector: **crest factor
// spans only 10.0–17.4 dB across every clip, which is what steady noise measures; a bed carrying
// one-shots measures well above 20.** Two independent instruments agreeing is why this is not
// filed as a detector artefact.
//
// It is not that the events were missing. `renderBedOffline()` scheduled them, `audioLog` counted
// them, and the round-1 verdict measured nine of thirteen regions firing an L3 event in a 20 s
// clip. They were **below the bed**. RI-AUD03 §A spends its "Level (rel. bed)" column on the
// LAYER's `level_db` — L3 at −6…+2 dB, "may exceed the bed"; L4 at −4…+4 — and then every event's
// synth carries its OWN `gain_db` of −6 to −13 on top of that, and nothing in this project ever
// summed the two against a bed that had actually been rendered. Every bed declared compliance and
// no bed delivered it. It is the same failure `bed_gain_db` exists to fix, one layer down:
// **loudness is not the sum of the numbers you typed.**
//
// HOW IT MEASURES, AND WHY THAT SHAPE. The declared numbers cannot answer "how far above the
// floor does a drip get?", because a noise grain normalised to ±0.9 and then band-passed is not
// the same loudness as a sine at the same `gain_db`. So this tool never reads a level out of the
// data. For each region it renders the SAME SEED TWICE — once whole, once with `mute:
// ['L3','L4','R7']` — and subtracts. The bed cancels to the sample (the continuous voices draw
// from `Rng(h ^ 0x51ed)`, an RNG the event scheduler never touches), and what is left is the
// event signal alone, at its true rendered level, which can then be put next to the bed's own
// RMS in the same 50 ms window. That difference is the number §A's band is about.
//
// The onset detector is written here from scratch and is NOT the blind pack's. It has to be: the
// pack's detector is the instrument whose reading is being acted on, and an instrument that
// checks itself proves nothing. The two agree on the shipped tree — both find zero — which is
// the corroboration, and O2's crest measurement agrees with both without a detector at all.
//
//   node tools/analysis/ambience-onsets.mjs [--seconds 120] [--rate 16000] [--json]
//   node tools/analysis/ambience-onsets.mjs --sabotage silent     # events muted -> MUST go red
//   node tools/analysis/ambience-onsets.mjs --sabotage quiet      # events -20 dB -> MUST go red
//   node tools/analysis/ambience-onsets.mjs --sabotage untrimmed  # DELETE THE FIX: event_gain_db
//                                                                 # forced to 0 in the page, which
//                                                                 # is the round-1 build exactly
//
// Exit 0 = every gate passed. 1 = a gate failed. 2 = the build could not be driven.

import { writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const USAGE = `
ambience-onsets.mjs — do the ambience event layers actually break the surface of the bed?

USAGE
  node tools/analysis/ambience-onsets.mjs [--seconds <n>] [--rate <hz>] [--out <file>] [--json]
                                          [--sabotage silent|quiet]

GATES
  O1  every bed produces a detectable event in both time-of-day bands, and the province detects
      at least half the events it scheduled
  O2  the event layers change the bed's dynamics: they must lift the crest factor of their OWN
      bed (the same render with the event layers muted) by >=3 dB
  O3  measured event level relative to the bed sits inside RI-AUD03 SectionA's own bands,
      L3 in -6..+2 dB and L4 in -4..+4 dB, with a stated +/-2 dB measurement tolerance

--sabotage exists so the gates can be shown to fail. A probe that cannot go red is not a probe.
  silent     the event layers are muted in the measured mix
  quiet      the recovered event signal is attenuated 20 dB and re-mixed
  untrimmed  DELETE-THE-FIX: event_gain_db is forced to 0 in the page, reproducing round 1's
             build exactly, on today's tree. Nothing on disk is touched.

Exit 0 = every gate passed. 1 = a gate failed. 2 = the build could not be driven.
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const SECONDS = Number(args.seconds || 120);
const RATE = Number(args.rate || 16000);
const SABOTAGE = args.sabotage || null;
if (SABOTAGE && !['silent', 'quiet', 'untrimmed'].includes(SABOTAGE)) {
  console.error(`ambience-onsets: --sabotage must be 'silent', 'quiet' or 'untrimmed', got ${JSON.stringify(SABOTAGE)}`);
  process.exit(2);
}

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const AMB = join(ROOT, 'game/data/audio/ambience');
// Every bed in the build, exterior and interior, measured by one instrument. The thirteen region
// beds live in `audio/ambience/` and the R4 / RI-WLD08 §6 interior and settlement beds in
// `audio/ambience/interiors/`. An interior bed that nothing measures is how round 1 shipped
// thirteen calibrated exteriors and absolute silence indoors; there is no reason to build a
// second set of beds and then grade only the first.
const regions = [
  ...JSON.parse(readFileSync(join(ROOT, 'game/data/world/regions.json'), 'utf8')).regions
      .map((r) => ({ id: r.id, kind: 'region', file: join(AMB, `${r.id}.json`) })),
  ...readdirSync(join(AMB, 'interiors')).filter((f) => f.endsWith('.json'))
      .map((f) => ({ id: f.replace(/\.json$/, ''), kind: 'interior',
                     file: join(AMB, 'interiors', f) })),
].map((r) => {
  // WHERE THE LISTENER STANDS, and it is not a detail. The first acceptance run reported ZERO
  // events for Marauder's Coast and the Salt Hills, and the cause was this tool rather than those
  // beds: §B gives Marauder's Coast's L3 as "rope creak; **one bell buoy audible from 600 m**" and
  // the Salt Hills' as "**legion horn on the hour** — diegetic clock". Both signatures are R7
  // emitters, and an emitter only sounds for a listener inside its `audible_m`. Capturing those
  // regions from wherever the player happened to be standing measured the two regions in the game
  // whose punctuation is a landmark, with the landmark out of earshot.
  //
  // So a bed with emitters is captured from `ref_m` away from its first one — close enough to
  // hear it, far enough not to be standing inside it. §C leans on exactly these strikes to
  // separate the four (wet, open, living) regions, so this is also the listener position the
  // blind test's own key assumes.
  try {
    const bed = JSON.parse(readFileSync(r.file, 'utf8'));
    const e = (bed.emitters || [])[0];
    if (e && Array.isArray(e.pos_m)) {
      r.listener = [e.pos_m[0] + (e.ref_m || 20), e.pos_m[1], 0];
      r.listener_note = `${e.ref_m || 20} m from ${e.id}`;
    }
  } catch { /* a bed that will not parse is the census's problem, not this tool's */ }
  return r;
});

// RI-AUD03 §A, the "Level (rel. bed)" column, verbatim. These are the item's numbers, not this
// tool's; the tolerance is this tool's and is declared rather than folded into the band.
const BANDS = { L3: [-6, 2], L4: [-4, 4] };
const TOL_DB = 2;
// CREST FACTOR, AND A CONFLICT BETWEEN THE JUDGE'S HEURISTIC AND THE ITEM'S OWN TABLE.
//
// The B2 judge measured 10.0-17.4 dB across 64 recordings and gave ">20 dB" as what a bed carrying
// one-shots measures. That is a sound heuristic about real recordings and it is NOT REACHABLE HERE
// while RI-AUD03 §A is obeyed, which is worth stating rather than quietly dropping.
//
// The arithmetic. This build's filtered-noise beds measure ~12 dB of crest on their own. Clip
// crest is set by the loudest peak over the clip RMS, so for an event to lift it past 20 dB the
// event's peak must clear the bed's RMS by ~20 dB. A short grain carries perhaps 6-10 dB of its
// own peak-to-RMS inside its window, which leaves the event's WINDOW LEVEL needing to sit around
// +10 dB relative to the bed. §A's "Level (rel. bed)" column caps L3 at **+2 dB** and L4 at +4.
//
// So O2-as-an-absolute-bar and O3 cannot both be satisfied: hitting 20 dB of crest requires
// putting the events roughly 8 dB outside the band the item specifies. Chasing the bar would mean
// failing the item to pass a heuristic borrowed from a different kind of recording.
//
// What replaces it is a CONTROLLED comparison rather than a looser absolute. Each bed is already
// rendered twice — whole, and with the event layers muted — so the honest question is whether the
// events change the bed's dynamics at all, measured against that bed's own floor. `crest_delta_db`
// is that number, it is immune to the tension above, and it is exactly what "does anything happen"
// means. The absolute figure is still reported next to the judge's 20 dB so the tension stays
// visible to whoever reads this next.
const CREST_DELTA_DB = 3;               // the events must lift their own bed's crest by this much
const CREST_JUDGE_REF_DB = 20;          // reported, not gated — see above

// ---- DSP, Node side. Every figure below is computed from samples the browser handed back. ----

function decode(cap) {
  const raw = Buffer.from(cap.pcm16_interleaved_b64, 'base64');
  const n = raw.length >> 2;
  const m = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    m[i] = 0.5 * (raw.readInt16LE(i * 4) / 32767 + raw.readInt16LE(i * 4 + 2) / 32767);
  }
  return m;
}
function peak(a) { let p = 0; for (let i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i])); return p; }
function rms(a, from = 0, to = a.length) {
  let s = 0; const n = Math.max(1, to - from);
  for (let i = from; i < to; i++) s += a[i] * a[i];
  return Math.sqrt(s / n);
}
const db = (g) => 20 * Math.log10(Math.max(1e-12, g));
function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

/**
 * Crest factor: peak over RMS, in dB. Deliberately the plain unweighted form rather than the
 * peak-to-loudness ratio the pack uses — a second definition of the same idea, so that agreeing
 * with the pack's 10.0-17.4 dB reading is agreement between two instruments and not one
 * instrument quoted twice.
 */
function crestDb(x) { return db(peak(x)) - db(rms(x)); }

/**
 * Gated K-weighted integrated loudness, BS.1770-4. Only used to give the INTERIOR beds a
 * `bed_lufs_target` they actually land on — the thirteen region beds are owned by
 * `ambience-render.mjs --calibrate`, which has B5's gate on it, and two tools writing the same
 * field to the same file is how a build ends up with two mixes.
 */
function lufsIntegrated(x, fs) {
  const y = highpass(shelf(x, fs), fs, 38.13, 0.5);
  const block = Math.round(0.4 * fs), hop = Math.round(0.1 * fs);
  const loud = [];
  for (let o = 0; o + block <= y.length; o += hop) {
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
/** BS.1770 stage 1: high shelf, +4 dB at 1681 Hz. */
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
function biquad(x, b0, b1, b2, a1, a2) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/** One-pole-pair Butterworth high-pass, used only by the onset detector. */
function highpass(x, fs, f0, q = 1 / Math.SQRT2) {
  const w = 2 * Math.PI * f0 / fs, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
  const b0 = (1 + cw) / 2, b1 = -(1 + cw), b2 = (1 + cw) / 2;
  const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
  const B0 = b0 / a0, B1 = b1 / a0, B2 = b2 / a0, A1 = a1 / a0, A2 = a2 / a0;
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = B0 * x[i] + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/**
 * Onsets from a short-time energy envelope, written here rather than borrowed.
 *
 * The rule is deliberately close to the blind pack's in SHAPE — a frame that is well above the
 * clip's own median energy and well above the frame before it — because that is what "a discrete
 * sound event" means and inventing a different definition to get a different answer would be
 * marking my own homework. It differs in every constant, and it reports the level the transient
 * reached over the running floor, which the pack's does not.
 */
function onsets(x, fs) {
  // DETECT ON THE HIGH-PASSED SIGNAL, and this is a correction to this tool rather than a
  // convenience. The first version ran on the broadband mix and reported 98 onsets in the Stone
  // Wastes while reporting zero everywhere else — all of them false. That bed is a brown drone
  // low-passed at 70 Hz, and at 70 Hz a 10 ms frame is most of a cycle, so frame-to-frame energy
  // swings by more than the 1.5x rise test on the carrier alone. The detector was firing on the
  // waveform of the floor, not on anything happening.
  //
  // A discrete sound event — a drip, a snap, a creak, a wingbeat — is broadband and has an edge;
  // that is what makes it discrete rather than part of the floor. Perceptual onset detectors
  // high-pass for exactly this reason. 300 Hz keeps every event synth in the province (the
  // lowest-centred is a 145 Hz band-passed door at Stormhold, whose attack still carries well
  // above 300) and removes the L1 rumble that every bed is mostly made of.
  // TWO TIMESCALES, and this widening was made AFTER the first acceptance run rather than before
  // it. Saying so plainly, because a detector changed after seeing its own result is exactly the
  // move that needs justifying, and the justification has to be the item rather than the score.
  //
  // The 10 ms-only version reported zero events for Marauder's Coast and the Salt Hills. Their L3
  // signatures are `rope_creak` (attack 0.14 s) and `dry_grass_gust` (attack 0.45 s) — §B's own
  // words for those two regions — and a 10 ms rise test cannot see a sound that takes half a
  // second to arrive. It was measuring TRANSIENTS, and the question the B2 judge actually asked
  // was "does anything happen", whose own phrasing is "not one bird, drip, gust or creak". A gust
  // is an event. A detector that structurally cannot register the signature the item assigns to a
  // region is not a strict gate, it is a broken one.
  //
  // So: a fast pass on 10 ms frames for drips, snaps and bells, and a slow pass on 100 ms frames
  // for gusts, creaks and swells. An event counts if either sees it. What stops this from being a
  // fudge is `--sabotage silent`, which mutes the event layers and must still report zero — if the
  // slow pass had started firing on the bed's own wander, that arm would go green and say so.
  const hp = highpass(x, fs, 300);
  const found = [];
  for (const [win, riseK, name] of [[0.01, 1.5, 'fast'], [0.1, 1.35, 'slow']]) {
    const H = Math.round(fs * win);
    const env = [];
    for (let o = 0; o + H <= hp.length; o += H) env.push(rms(hp, o, o + H));
    if (env.length < 3) continue;
    const med = median(env) || 1e-9;
    let i = 1;
    while (i < env.length) {
      // 3x the clip's own median frame energy (+9.5 dB over the floor), reached with a real rise.
      // Both conditions matter: the level alone fires on a slow swell of the floor itself, the
      // rise alone fires on noise. The slow pass uses a gentler rise because a 100 ms frame has
      // already integrated most of a gust's attack.
      if (env[i] > med * 3 && env[i] > env[i - 1] * riseK) {
        let j = i;
        while (j < env.length && env[j] > med * 1.5) j++;
        found.push({ at_s: +(i * H / fs).toFixed(2), duration_s: +((j - i) * H / fs).toFixed(2),
                     over_floor_db: +db(env[i] / med).toFixed(1), scale: name });
        i = j + 1;
      } else i++;
    }
  }
  // One sound may be seen by both passes. Merge anything within 250 ms so an event is counted
  // once — otherwise the wide-timescale pass would inflate the count it was added to fix.
  found.sort((a, b) => a.at_s - b.at_s);
  const out = [];
  for (const f of found) {
    const prev = out[out.length - 1];
    if (prev && f.at_s - prev.at_s < 0.25) { if (f.over_floor_db > prev.over_floor_db) Object.assign(prev, f); continue; }
    out.push(f);
  }
  return out;
}

/**
 * How loud one scheduled event got, relative to the bed it landed on.
 *
 * `evt` is the event signal alone (full render minus bed-only render) and `bed` is the bed-only
 * render. Both are the same seed, so sample `i` in one is the same instant as sample `i` in the
 * other. The comparison window is 50 ms around the event's own peak rather than the whole clip,
 * because §A's band is about how far the drip gets above the floor AT THE MOMENT IT LANDS — a
 * clip-average would let a loud rare event and a quiet frequent one report the same number.
 */
function eventLevelRelBed(evt, bed, fs, atS, holdS = 1.2) {
  const from = Math.max(0, Math.floor(atS * fs));
  const to = Math.min(evt.length, Math.ceil((atS + holdS) * fs));
  if (to - from < 8) return null;
  let pk = 0, pkAt = from;
  for (let i = from; i < to; i++) { const v = Math.abs(evt[i]); if (v > pk) { pk = v; pkAt = i; } }
  if (pk <= 0) return null;
  const w = Math.round(fs * 0.05);
  const a = Math.max(0, pkAt - (w >> 1)), b = Math.min(evt.length, a + w);
  const e = rms(evt, a, b), f = rms(bed, a, b);
  if (e <= 0 || f <= 0) return null;
  return { rel_db: +db(e / f).toFixed(2), peak_dbfs: +db(pk).toFixed(2), at_s: +atS.toFixed(2) };
}

// ---- drive the build --------------------------------------------------------------------------

function gitStamp() {
  try {
    const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { commit: sh('git rev-parse --short HEAD'), dirty: sh('git status --porcelain') !== '' };
  } catch { return { commit: null, dirty: null }; }
}

const out = {
  tool: 'tools/analysis/ambience-onsets.mjs',
  taken_at: new Date().toISOString(),
  git: gitStamp(),
  seconds: SECONDS, sample_rate: RATE, sabotage: SABOTAGE,
  bands_rel_bed_db: BANDS, tolerance_db: TOL_DB,
  gates: {}, regions: {}, notes: [],
};
if (SABOTAGE) {
  out.notes.push(`SABOTAGE RUN (--sabotage ${SABOTAGE}). This run is expected to FAIL. It exists to `
    + 'show the gates can go red; a green here would mean the instrument is measuring nothing.');
}

let handle, exitCode = 0;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
  const up = await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 })
    .then(() => true).catch(() => false);
  if (!up) { console.error('ambience-onsets: the game did not boot.'); process.exit(2); }
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));

  // The `mute` option is what makes the bed subtractable. If the engine on this tree does not
  // honour it, every number below would silently become a measurement of the full mix minus
  // itself — zero — and the tool would report a confident, meaningless red. Check it first.
  const muteWorks = await page.evaluate(async () => {
    const E = window.__ENGINE;
    const a = await E.ambienceCapture({ region: 'blackwood', seconds: 4, sampleRate: 8000, tod: 'day' });
    const b = await E.ambienceCapture({ region: 'blackwood', seconds: 4, sampleRate: 8000, tod: 'day',
                                        mute: ['L3', 'L4', 'R7'] });
    return { full: (a.fired || []).length, muted: (b.fired || []).length, ok: a.ok && b.ok };
  });
  out.mute_supported = muteWorks;
  if (!muteWorks.ok || muteWorks.muted !== 0) {
    console.error('ambience-onsets: ambienceCapture({mute}) is not honoured by this build — '
      + JSON.stringify(muteWorks) + '. Every subtraction below would be vacuous. Refusing to report.');
    process.exit(2);
  }

  // DELETE-THE-FIX (AGENT-PROTOCOL rule 6). Zero every `event_gain_db` IN THE PAGE — the files on
  // disk are never touched, so a kill halfway leaves the tree exactly as it was — and re-measure.
  // This is the round-1 build reproduced on today's tree, which is a stronger control than the
  // round-1 numbers themselves: it holds the 30 s loop buffers, the recalibrated bed trims and the
  // corrected onset detector fixed, and moves only the thing being claimed.
  if (SABOTAGE === 'untrimmed') {
    out.untrimmed = await page.evaluate(() => {
      let n = 0;
      for (const bed of Object.values(window.__ENGINE.ambience.beds)) {
        for (const L of ['L3', 'L4']) {
          const layer = bed.layers && bed.layers[L];
          if (layer && layer.event_gain_db) { layer.event_gain_db = 0; n++; }
        }
        for (const e of bed.emitters || []) if (e.event_gain_db) { e.event_gain_db = 0; n++; }
      }
      return { layers_zeroed: n };
    });
    if (!out.untrimmed.layers_zeroed) {
      console.error('ambience-onsets --sabotage untrimmed: nothing to zero — no bed carries an '
        + 'event_gain_db, so deleting the fix would delete nothing and the control is vacuous.');
      process.exit(2);
    }
  }

  const allOnsetTotals = [], allCrest = [], allDelta = [], relByLayer = { L3: [], L4: [], R7: [] };
  let firedTotal = 0, onsetTotal = 0;

  for (const r of regions) {
    const rec = out.regions[r.id] = { tod: {}, kind: r.kind };
    if (r.listener) { rec.listener = r.listener; rec.listener_note = r.listener_note; }
    for (const tod of ['day', 'night']) {
      const capOpts = { region: r.id, seconds: SECONDS, sampleRate: RATE, tod };
      if (r.listener) capOpts.listener = r.listener;
      const [full, bedOnly] = await page.evaluate(async ({ o, sab }) => {
        const E = window.__ENGINE;
        // The sabotage arms operate on the CAPTURE, never on the data on disk — nothing this
        // tool does can leave the tree changed if it is killed halfway.
        const fullOpts = sab === 'silent' ? { ...o, mute: ['L3', 'L4', 'R7'] } : { ...o };
        const a = await E.ambienceCapture(fullOpts);
        const b = await E.ambienceCapture({ ...o, mute: ['L3', 'L4', 'R7'] });
        return [a, b];
      }, { o: capOpts, sab: SABOTAGE });

      if (!full.ok || !bedOnly.ok) {
        rec.tod[tod] = { error: full.why || bedOnly.why };
        exitCode = 1;
        continue;
      }
      const F = decode(full), B = decode(bedOnly);
      const n = Math.min(F.length, B.length);
      const E = new Float64Array(n);
      for (let i = 0; i < n; i++) E[i] = F[i] - B[i];
      // The 'quiet' arm attenuates the recovered event signal by 20 dB and re-mixes it, which is
      // exactly what shipping the round-1 levels did. It must take O1 and O3 red.
      if (SABOTAGE === 'quiet') {
        for (let i = 0; i < n; i++) { E[i] *= 0.1; F[i] = B[i] + E[i]; }
      }

      const det = onsets(F, RATE);
      const crest = +crestDb(F).toFixed(1);
      // The same bed with its event layers muted. This is the control O2 is gated on: the
      // difference is what the events did, measured against this bed's own floor rather than
      // against an absolute borrowed from elsewhere.
      const crestBed = +crestDb(B).toFixed(1);
      const fired = (full.fired || []).filter((f) => f.layer !== 'emitter' || f.mode !== 'continuous');
      const levels = [];
      for (const f of fired) {
        const m = eventLevelRelBed(E, B, RATE, f.at_s || 0);
        if (!m) continue;
        const layer = f.layer === 'emitter' ? 'R7' : f.layer;
        levels.push({ layer, id: f.id, ...m });
        if (relByLayer[layer]) relByLayer[layer].push(m.rel_db);
      }
      const byLayer = {};
      for (const k of ['L3', 'L4', 'R7']) {
        const xs = levels.filter((l) => l.layer === k).map((l) => l.rel_db);
        byLayer[k] = xs.length ? { n: xs.length, median_rel_db: +median(xs).toFixed(2),
                                   min_rel_db: +Math.min(...xs).toFixed(2),
                                   max_rel_db: +Math.max(...xs).toFixed(2) } : null;
      }
      rec.tod[tod] = {
        scheduled: fired.length,
        onsets_detected: det.length,
        onsets_per_min: +(det.length / (SECONDS / 60)).toFixed(2),
        crest_factor_db: crest,
        crest_factor_bed_only_db: crestBed,
        crest_delta_db: +(crest - crestBed).toFixed(1),
        event_peak_dbfs: +db(peak(E)).toFixed(2),
        bed_rms_dbfs: +db(rms(B)).toFixed(2),
        bed_lufs_i: +lufsIntegrated(B, RATE).toFixed(2),
        mix_lufs_i: +lufsIntegrated(F, RATE).toFixed(2),
        level_rel_bed: byLayer,
        onsets: det.slice(0, 8),
        events: levels.slice(0, 12),
      };
      // The report keeps a readable sample; --calibrate needs every measurement, so the full list
      // rides along non-enumerably and never reaches the JSON on disk.
      Object.defineProperty(rec.tod[tod], '_all', { value: levels, enumerable: false });
      allOnsetTotals.push(det.length);
      allCrest.push(crest);
      allDelta.push(+(crest - crestBed).toFixed(1));
      firedTotal += fired.length;
      onsetTotal += det.length;
    }
  }

  // ---- the gates ------------------------------------------------------------------------------
  const silentRegions = [], lowDelta = [];
  for (const [id, rec] of Object.entries(out.regions)) {
    for (const [tod, t] of Object.entries(rec.tod)) {
      if (t.error) continue;
      if (!t.onsets_detected) silentRegions.push(`${id}/${tod}`);
      if (t.crest_delta_db < CREST_DELTA_DB) lowDelta.push(`${id}/${tod} ${t.crest_delta_db}`);
    }
  }
  const detectRatio = firedTotal ? +(onsetTotal / firedTotal).toFixed(3) : 0;
  out.gates.O1_events_are_audible = {
    pass: silentRegions.length === 0 && detectRatio >= 0.5,
    scheduled: firedTotal, detected: onsetTotal, detect_ratio: detectRatio,
    silent_region_tod: silentRegions,
    what: 'every bed produces a detectable event in both time-of-day bands, and the province '
      + 'detects at least half the events it scheduled',
  };
  out.gates.O2_events_change_the_dynamics = {
    pass: lowDelta.length === 0,
    median_delta_db: allDelta.length ? +median(allDelta).toFixed(1) : 0,
    delta_bar_db: CREST_DELTA_DB,
    below_bar: lowDelta,
    median_absolute_crest_db: allCrest.length ? +median(allCrest).toFixed(1) : 0,
    judge_reference_db: CREST_JUDGE_REF_DB,
    note: 'The absolute figure is REPORTED, not gated. The B2 judge\'s ">20 dB" heuristic and '
      + 'RI-AUD03 §A\'s "L3 at -6..+2 dB rel. bed" cannot both be met — reaching 20 dB of crest on '
      + 'a ~12 dB noise bed needs the events roughly 8 dB outside §A\'s band. The gate is therefore '
      + 'the within-bed control: how much the events lift the crest of THEIR OWN bed, measured '
      + 'against the same render with the event layers muted.',
    what: 'the event layers measurably change the dynamics of the bed they sit on',
  };
  // O3 IS PER BED AND PER LAYER, not a province median, and that is a correction to this tool.
  //
  // The first version took the median of every measured event in the province and asked whether
  // THAT sat in §A's band. It passed — at -2.12 dB for L3 and +0.32 for L4 — while four bed/layer
  // pairs sat outside it (clay-moor L3 at +4.91 and L4 at +9.56, marauders-coast L4 at -10.81,
  // stone-forest L4 at -10.15). A province median is exactly the statistic that lets a loud bed
  // and a quiet bed cancel into a green, and §A's band is written per layer of a region, not over
  // an average of thirteen. Gating the average was measuring the wrong thing.
  const bandFails = [];
  const perBed = {};
  for (const [id, rec] of Object.entries(out.regions)) {
    for (const layer of Object.keys(BANDS)) {
      const xs = [];
      for (const t of Object.values(rec.tod)) {
        if (t.error) continue;
        for (const e of t._all || t.events || []) if (e.layer === layer) xs.push(e.rel_db);
      }
      if (!xs.length) continue;
      const m = +median(xs).toFixed(2);
      const [lo, hi] = BANDS[layer];
      (perBed[id] = perBed[id] || {})[layer] = { n: xs.length, median_rel_db: m };
      if (m < lo - TOL_DB || m > hi + TOL_DB) {
        bandFails.push(`${id}/${layer}: ${m} dB outside ${lo}..${hi} +/-${TOL_DB}`);
      }
    }
  }
  if (!Object.keys(perBed).length) bandFails.push('no events measured anywhere');
  out.gates.O3_level_in_band = {
    pass: bandFails.length === 0,
    per_bed: perBed,
    province_median: Object.fromEntries(Object.entries(relByLayer).map(([k, xs]) =>
      [k, xs.length ? { n: xs.length, median_rel_db: +median(xs).toFixed(2) } : null])),
    failures: bandFails,
    what: 'EVERY bed\'s measured event level, per layer, sits inside RI-AUD03 §A\'s own bands '
      + `(L3 -6..+2, L4 -4..+4) within the declared +/-${TOL_DB} dB tolerance. Checked per bed `
      + 'rather than over a province median, because an average lets a loud bed and a quiet bed '
      + 'cancel into a green.',
  };

  if (pageErrors.length) { out.page_errors = pageErrors; exitCode = 1; }
  for (const g of Object.values(out.gates)) if (!g.pass) exitCode = 1;

  // ---- --calibrate: write the per-layer event trim ---------------------------------------------
  //
  // The same shape as `ambience-render.mjs --calibrate`, which writes `bed_gain_db`, and it comes
  // with the same warning: THE RUN THAT WRITES A TRIM AND THEN RE-MEASURES IT PROVES NOTHING.
  // A calibration pass is only evidence when a LATER, separate run re-measures it and finds it
  // still in band — so this path writes the data and exits without grading, and the acceptance
  // number has to come from a plain run afterwards.
  if (args.calibrate && !SABOTAGE) {
    const centre = { L3: (BANDS.L3[0] + BANDS.L3[1]) / 2, L4: (BANDS.L4[0] + BANDS.L4[1]) / 2 };
    const written = [];
    for (const [id, rec] of Object.entries(out.regions)) {
      const file = (regions.find((r) => r.id === id) || {}).file;
      if (!file) continue;
      let bed;
      try { bed = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
      let touched = false;
      for (const layer of ['L3', 'L4']) {
        // Pool both time-of-day bands: a night-only event carries the same within-layer relative
        // weight as its daytime sibling, and calibrating on day alone would leave it uncorrected.
        const xs = [];
        for (const t of Object.values(rec.tod)) {
          if (t.error) continue;
          for (const e of t._all || t.events || []) if (e.layer === layer) xs.push(e.rel_db);
        }
        if (!xs.length || !bed.layers[layer]) continue;
        const measured = median(xs);
        const prev = bed.layers[layer].event_gain_db || 0;
        const next = +(prev + (centre[layer] - measured)).toFixed(2);
        bed.layers[layer].event_gain_db = next;
        written.push({ region: id, layer, n: xs.length, measured_rel_db: +measured.toFixed(2),
                       target_rel_db: centre[layer], event_gain_db: next, was: prev });
        touched = true;
      }
      // The INTERIOR beds' master trim. The thirteen region beds are deliberately not touched
      // here — `ambience-render.mjs --calibrate` owns `bed_gain_db` for those and B5 gates them,
      // and two tools writing one field into one file is how a build acquires two mixes. The
      // interiors are new in round 2 and that tool does not know about them.
      const meta = regions.find((r) => r.id === id);
      if (meta && meta.kind === 'interior') {
        const ls = Object.values(rec.tod).filter((t) => !t.error && isFinite(t.bed_lufs_i))
          .map((t) => t.bed_lufs_i);
        if (ls.length && bed.bed_lufs_target !== undefined) {
          const measured = median(ls);
          const prev = bed.bed_gain_db || 0;
          bed.bed_gain_db = +(prev + (bed.bed_lufs_target - measured)).toFixed(2);
          bed.bed_gain_db_note = 'Master trim, in dB, that lands this interior bed on its own '
            + 'bed_lufs_target. Calibrated by measurement (tools/analysis/ambience-onsets.mjs '
            + '--calibrate), not guessed. The run that writes it and re-measures it is '
            + 'self-fulfilling and proves nothing on its own; the value is in every later run.';
          written.push({ region: id, layer: 'bed', measured_lufs_i: +measured.toFixed(2),
                         target_lufs: bed.bed_lufs_target, bed_gain_db: bed.bed_gain_db, was: prev });
          touched = true;
        }
      }
      if (touched) writeFileSync(file, JSON.stringify(bed, null, 2) + '\n');
    }
    out.calibration = written;
    out.notes.push('CALIBRATION RUN. `event_gain_db` was written from the measurement above and '
      + 'this run is therefore self-fulfilling and is NOT evidence. Re-run without --calibrate.');
    console.error(`ambience-onsets --calibrate: wrote ${written.length} layer trims. `
      + 'Re-run without --calibrate for a number that means something.');
    exitCode = 0;
  }

  if (SABOTAGE) {
    // A sabotage run INVERTS the meaning of the exit code: red is the pass.
    out.sabotage_result = exitCode === 1 ? 'RED as required' : 'GREEN — THE INSTRUMENT IS BROKEN';
    exitCode = exitCode === 1 ? 0 : 1;
  }
} finally {
  if (handle) await handle.close();
}

const outPath = args.out || join(ROOT, 'reports', 'w1-22', `ambience-onsets${SABOTAGE ? '-sab-' + SABOTAGE : ''}.json`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2));

if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`ambience-onsets @ ${out.git.commit}${out.git.dirty ? ' (dirty)' : ''} — `
    + `${SECONDS}s x ${Object.keys(out.regions).length} regions x2 tod @ ${RATE} Hz`
    + (SABOTAGE ? `  [SABOTAGE ${SABOTAGE}]` : ''));
  for (const [id, rec] of Object.entries(out.regions)) {
    const d = rec.tod.day || {}, n = rec.tod.night || {};
    const f = (t) => t.error ? 'ERR' : `${String(t.onsets_detected).padStart(3)}/${String(t.scheduled).padStart(2)} ${String(t.crest_factor_db).padStart(5)}dB`;
    console.log(`  ${id.padEnd(19)} day ${f(d)}   night ${f(n)}`);
  }
  for (const [k, g] of Object.entries(out.gates)) {
    console.log(`${g.pass ? 'PASS' : 'FAIL'}  ${k}`);
    if (!g.pass) console.log(`      ${JSON.stringify({ ...g, what: undefined })}`);
  }
  if (SABOTAGE) console.log(`SABOTAGE ${SABOTAGE}: ${out.sabotage_result}`);
  console.log(`report: ${outPath}`);
}
process.exit(exitCode);
