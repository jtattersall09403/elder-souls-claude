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
// the corroboration, and the crest-factor gate agrees with both without a detector at all.
//
//   node tools/analysis/ambience-onsets.mjs [--seconds 120] [--rate 16000] [--json]
//   node tools/analysis/ambience-onsets.mjs --sabotage silent   # events muted -> MUST go red
//   node tools/analysis/ambience-onsets.mjs --sabotage quiet    # events -20 dB -> MUST go red
//
// Exit 0 = every gate passed. 1 = a gate failed. 2 = the build could not be driven.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
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
  O1  every region produces a detectable transient in every time-of-day band, and the province
      detects at least half the events it scheduled
  O2  every region's crest factor clears 18 dB and the province median clears 20 dB — the range
      the B2 judge measured for steady noise was 10.0-17.4 dB
  O3  measured event level relative to the bed sits inside RI-AUD03 SectionA's own bands,
      L3 in -6..+2 dB and L4 in -4..+4 dB, with a stated +/-2 dB measurement tolerance

--sabotage exists so the gates can be shown to fail. A probe that cannot go red is not a probe.

Exit 0 = every gate passed. 1 = a gate failed. 2 = the build could not be driven.
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const SECONDS = Number(args.seconds || 120);
const RATE = Number(args.rate || 16000);
const SABOTAGE = args.sabotage || null;
if (SABOTAGE && !['silent', 'quiet'].includes(SABOTAGE)) {
  console.error(`ambience-onsets: --sabotage must be 'silent' or 'quiet', got ${JSON.stringify(SABOTAGE)}`);
  process.exit(2);
}

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const regions = JSON.parse(readFileSync(join(ROOT, 'game/data/world/regions.json'), 'utf8')).regions;

// RI-AUD03 §A, the "Level (rel. bed)" column, verbatim. These are the item's numbers, not this
// tool's; the tolerance is this tool's and is declared rather than folded into the band.
const BANDS = { L3: [-6, 2], L4: [-4, 4] };
const TOL_DB = 2;
// The B2 judge measured 10.0-17.4 dB of crest factor across 64 steady-noise recordings and gave
// ">20 dB" as what a bed carrying one-shots measures. 18 is the floor no clip in that pack
// reached; 20 is the judge's own stated discriminator, applied to the median.
const CREST_FLOOR_DB = 18, CREST_MEDIAN_DB = 20;

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
 * Onsets from a short-time energy envelope, written here rather than borrowed.
 *
 * The rule is deliberately close to the blind pack's in SHAPE — a frame that is well above the
 * clip's own median energy and well above the frame before it — because that is what "a discrete
 * sound event" means and inventing a different definition to get a different answer would be
 * marking my own homework. It differs in every constant, and it reports the level the transient
 * reached over the running floor, which the pack's does not.
 */
function onsets(x, fs) {
  const H = Math.round(fs * 0.01);                       // 10 ms frames
  const env = [];
  for (let o = 0; o + H <= x.length; o += H) env.push(rms(x, o, o + H));
  if (env.length < 3) return [];
  const med = median(env) || 1e-9;
  const out = [];
  let i = 1;
  while (i < env.length) {
    // 3x the clip's own median frame energy (+9.5 dB over the floor) reached in one 10 ms frame
    // with at least a 1.5x jump. Both conditions matter: the first alone fires on a slow swell,
    // the second alone fires on noise.
    if (env[i] > med * 3 && env[i] > env[i - 1] * 1.5) {
      let j = i;
      while (j < env.length && env[j] > med * 1.5) j++;
      out.push({
        at_s: +(i * H / fs).toFixed(2),
        duration_s: +((j - i) * H / fs).toFixed(2),
        over_floor_db: +db(env[i] / med).toFixed(1),
      });
      i = j + 1;
    } else i++;
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

  const allOnsetTotals = [], allCrest = [], relByLayer = { L3: [], L4: [], R7: [] };
  let firedTotal = 0, onsetTotal = 0;

  for (const r of regions) {
    const rec = out.regions[r.id] = { tod: {} };
    for (const tod of ['day', 'night']) {
      const capOpts = { region: r.id, seconds: SECONDS, sampleRate: RATE, tod };
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
        event_peak_dbfs: +db(peak(E)).toFixed(2),
        bed_rms_dbfs: +db(rms(B)).toFixed(2),
        level_rel_bed: byLayer,
        onsets: det.slice(0, 8),
        events: levels.slice(0, 12),
      };
      allOnsetTotals.push(det.length);
      allCrest.push(crest);
      firedTotal += fired.length;
      onsetTotal += det.length;
    }
  }

  // ---- the gates ------------------------------------------------------------------------------
  const silentRegions = [], lowCrest = [];
  for (const [id, rec] of Object.entries(out.regions)) {
    for (const [tod, t] of Object.entries(rec.tod)) {
      if (t.error) continue;
      if (!t.onsets_detected) silentRegions.push(`${id}/${tod}`);
      if (t.crest_factor_db < CREST_FLOOR_DB) lowCrest.push(`${id}/${tod} ${t.crest_factor_db}`);
    }
  }
  const detectRatio = firedTotal ? +(onsetTotal / firedTotal).toFixed(3) : 0;
  out.gates.O1_events_are_audible = {
    pass: silentRegions.length === 0 && detectRatio >= 0.5,
    scheduled: firedTotal, detected: onsetTotal, detect_ratio: detectRatio,
    silent_region_tod: silentRegions,
    what: 'every region produces a detectable transient in both time-of-day bands, and the '
      + 'province detects at least half the events it scheduled',
  };
  const medCrest = allCrest.length ? +median(allCrest).toFixed(1) : 0;
  out.gates.O2_crest_factor = {
    pass: lowCrest.length === 0 && medCrest >= CREST_MEDIAN_DB,
    median_db: medCrest, floor_db: CREST_FLOOR_DB, median_bar_db: CREST_MEDIAN_DB,
    below_floor: lowCrest,
    what: 'crest factor clears the steady-noise range the B2 judge measured (10.0-17.4 dB) in '
      + 'every region, and its median clears the judge\'s stated one-shot discriminator of 20 dB',
  };
  const bandFails = [];
  for (const [layer, band] of Object.entries(BANDS)) {
    const xs = relByLayer[layer];
    if (!xs.length) { bandFails.push(`${layer}: no events measured`); continue; }
    const m = +median(xs).toFixed(2);
    if (m < band[0] - TOL_DB || m > band[1] + TOL_DB) {
      bandFails.push(`${layer}: median ${m} dB outside ${band[0]}..${band[1]} +/-${TOL_DB}`);
    }
  }
  out.gates.O3_level_in_band = {
    pass: bandFails.length === 0,
    measured: Object.fromEntries(Object.entries(relByLayer).map(([k, xs]) =>
      [k, xs.length ? { n: xs.length, median_rel_db: +median(xs).toFixed(2) } : null])),
    failures: bandFails,
    what: 'measured event level relative to the rendered bed sits inside RI-AUD03 SectionA\'s own '
      + `bands (L3 -6..+2, L4 -4..+4) within the declared +/-${TOL_DB} dB tolerance`,
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
      const file = join(ROOT, 'game/data/audio/ambience', `${id}.json`);
      let bed;
      try { bed = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
      let touched = false;
      for (const layer of ['L3', 'L4']) {
        // Pool both time-of-day bands: a night-only event carries the same within-layer relative
        // weight as its daytime sibling, and calibrating on day alone would leave it uncorrected.
        const xs = [];
        for (const t of Object.values(rec.tod)) {
          if (t.error) continue;
          for (const e of t.events || []) if (e.layer === layer) xs.push(e.rel_db);
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
