#!/usr/bin/env node
// RI-AUD03 R5 — "Night is a different L2/L4 SELECTION, not a filter." W1-22 round 3.
//
// WHY THIS TOOL EXISTS. The round-2 verdict (§5.1) and the round-2 critic's own blog line both
// published the same thing: **nine of the thirteen regions render byte-identical at night and by
// day**. Not similar — identical. And then a five-trial "day against night" stratum was built on
// top of that knowledge, so a blind judge scored 5/5 on a contrast that does not exist in the
// audio. The judge found it from the other side, by SHA-256 over the feature vectors, and wrote:
// *"the `tod` parameter is being passed and is changing nothing."*
//
// A pack cannot repair that. The fix has to be in the world, and the world needs an instrument
// that can see it. This is that instrument, and it is deliberately the crudest possible one:
//
//     render each region at tod=day and tod=night, through the SHIPPED capture path, at the
//     SAME seed, and compare the PCM bytes.
//
// Byte identity is the right primitive here precisely because it cannot be argued with. A
// spectral distance can be made to look small or large by choosing a norm; two identical SHA-256
// digests over 640 000 samples mean the renderer produced the same file twice.
//
// WHAT IT REPORTS, per region:
//   identical      — day and night PCM are byte-for-byte the same. This is the defect.
//   sha_day/night  — the digests, so the claim is checkable from the report alone.
//   band_distance  — L1 distance between the two 24-band unit-normalised spectra. LEVEL-FREE, so
//                    "night is day at −8 dB" (RI-AUD03's own named failure, §How we lose) scores
//                    ZERO here. A filter is not a selection and this number knows the difference.
//   events_day/night — the event ids the scheduler actually fired in each. A different SELECTION
//                    shows up here; a different gain does not.
//   new_at_night / gone_at_night — the set difference. R5 in one line.
//
// GATES
//   R5a  every region differs day vs night at all (identical == 0/13)
//   R5b  the difference is a SELECTION, not a filter: band_distance above the floor OR the fired
//        event-id sets differ. A region that passes R5a only by dithering fails R5b.
//
// FALSIFICATION (rule 4). `--sabotage filter` renders night as day-with-a-gain-change instead of
// the real night selection: it forces `env.tod='day'` for the layer/event selection and then
// scales the output. R5a then still passes — the bytes differ — and **R5b must go red**, because
// a level change moves no unit-normalised band and fires no different event. If R5b stays green
// under `--sabotage filter`, this tool cannot tell a selection from a volume knob and its green
// is worthless.
//
//   node tools/audio/w1-22-r3-daynight.mjs [--seconds 30] [--rate 16000] [--sabotage filter]
//
// Exit 0 = both gates pass. 1 = a gate failed. 2 = the build could not be driven.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const USAGE = `
w1-22-r3-daynight.mjs — RI-AUD03 R5: is night a different SELECTION, or the same bed at another gain?

USAGE
  node tools/audio/w1-22-r3-daynight.mjs [--seconds <n>] [--rate <hz>] [--out <file>]
                                         [--sabotage filter]

Exit 0 = R5a and R5b both pass. 1 = a gate failed. 2 = the build could not be driven.
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const SECONDS = Number(args.seconds || 30);
const RATE = Number(args.rate || 16000);
const SABOTAGE = args.sabotage || null;
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const OUT = join(ROOT, args.out || 'reports/w1-22-r3/daynight.json');

// A band distance below this is "the same spectrum". Calibrated, not guessed: the smallest
// distance between two DIFFERENT regions' spectra in round 2's own separation proxy was 0.086
// (valus-ridge vs salt-hills, quoted in valus-ridge.json's L1 text). A day/night pair inside one
// region need not clear a whole region's worth of difference, so the floor is set an order of
// magnitude lower — but it is not zero, because a filter change with no selection change lands
// at exactly zero on a unit-normalised spectrum only if it is a pure gain, and real filters move
// it a little. 0.02 is roughly a quarter of the region-separation floor.
const BAND_FLOOR = 0.02;

function commit() {
  try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); }
  catch { return 'unknown'; }
}

// ---- Node-side DSP: 24-band unit-normalised spectrum ------------------------------------------
// Copied in spirit from tools/analysis/ambience-render.mjs. Unit-normalised on purpose: it makes
// the measurement blind to LEVEL, which is the entire point of R5.
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
const NBANDS = 24, FMIN = 40, FMAX = 8000;
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
      let b = Math.floor(NBANDS * Math.log(f / FMIN) / Math.log(FMAX / FMIN));
      if (b < 0) b = 0; if (b >= NBANDS) b = NBANDS - 1;
      bands[b] += Math.hypot(re[k], im[k]);
    }
    frames++;
  }
  let sum = 0;
  for (let b = 0; b < NBANDS; b++) sum += bands[b];
  const out = [];
  for (let b = 0; b < NBANDS; b++) out.push(sum > 0 ? bands[b] / sum : 0);
  return out;
}
function bandDistance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  return d;
}
/** Interleaved PCM16 base64 -> mono Float64Array, plus the raw bytes for hashing. */
function decode(b64) {
  const buf = Buffer.from(b64, 'base64');
  const n = buf.length / 4;              // 2 ch x 2 bytes
  const m = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const l = buf.readInt16LE(i * 4) / 32768, r = buf.readInt16LE(i * 4 + 2) / 32768;
    m[i] = (l + r) / 2;
  }
  return { mono: m, sha: createHash('sha256').update(buf).digest('hex') };
}

const out = {
  tool: 'tools/audio/w1-22-r3-daynight.mjs',
  item: 'RI-AUD03 R5',
  commit: commit(),
  seconds: SECONDS, sample_rate: RATE, sabotage: SABOTAGE,
  band_floor: BAND_FLOOR,
  regions: {}, gates: {},
};

let handle, exitCode = 0;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  const up = await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 })
    .then(() => true).catch(() => false);
  if (!up) { console.error('w1-22-r3-daynight: the game did not boot.'); process.exit(2); }
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));

  const caps = await page.evaluate(async ({ seconds, rate, sabotage }) => {
    const E = window.__ENGINE;
    const ids = Object.keys(E.ambience.beds).sort();
    const res = {};
    for (const id of ids) {
      // `listener: null` — the region bed alone. R5 is a claim about the BED's day/night
      // selection, and the R7 emitters (bell buoy, legion horn, kiln) are world-anchored
      // landmarks that do not change with the clock. Including them would add a constant to
      // both arms and could only ever make a null result look less null.
      const d = await E.ambienceCapture({ region: id, seconds, sampleRate: rate, tod: 'day', listener: null, seed: 0xa3b1 });
      let n;
      if (sabotage === 'filter') {
        // THE FALSIFIER. "Night is day at −8 dB" — RI-AUD03 §How we lose, verbatim:
        // "Weather and time-of-day are wired to gain instead of to selection." Render the DAY
        // selection and scale the samples. The bytes differ (R5a passes) and nothing about the
        // selection has moved (R5b must fail).
        const raw = await E.ambienceCapture({ region: id, seconds, sampleRate: rate, tod: 'day', listener: null, seed: 0xa3b1 });
        const buf = Uint8Array.from(atob(raw.pcm16_interleaved_b64), (c) => c.charCodeAt(0));
        const dv = new DataView(buf.buffer);
        const g = Math.pow(10, -8 / 20);
        for (let i = 0; i * 2 < buf.length; i++) dv.setInt16(i * 2, Math.round(dv.getInt16(i * 2, true) * g), true);
        let s = '';
        for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
        n = { ok: true, pcm16_interleaved_b64: btoa(s), sampleRate: raw.sampleRate, fired: raw.fired };
      } else {
        n = await E.ambienceCapture({ region: id, seconds, sampleRate: rate, tod: 'night', listener: null, seed: 0xa3b1 });
      }
      res[id] = {
        day: d.ok ? { b64: d.pcm16_interleaved_b64, fired: d.fired } : null,
        night: n.ok ? { b64: n.pcm16_interleaved_b64, fired: n.fired } : null,
      };
    }
    return res;
  }, { seconds: SECONDS, rate: RATE, sabotage: SABOTAGE });

  for (const [id, c] of Object.entries(caps)) {
    if (!c.day || !c.night) { out.regions[id] = { error: 'capture failed' }; continue; }
    const D = decode(c.day.b64), N = decode(c.night.b64);
    const bd = bandSpectrum(D.mono, RATE), bn = bandSpectrum(N.mono, RATE);
    const dayIds = [...new Set((c.day.fired || []).map((f) => f.id))].sort();
    const nightIds = [...new Set((c.night.fired || []).map((f) => f.id))].sort();
    out.regions[id] = {
      identical: D.sha === N.sha,
      sha_day: D.sha.slice(0, 16), sha_night: N.sha.slice(0, 16),
      band_distance: +bandDistance(bd, bn).toFixed(4),
      events_day: dayIds, events_night: nightIds,
      new_at_night: nightIds.filter((x) => !dayIds.includes(x)),
      gone_at_night: dayIds.filter((x) => !nightIds.includes(x)),
      n_events_day: (c.day.fired || []).length, n_events_night: (c.night.fired || []).length,
    };
  }
} catch (e) {
  console.error('w1-22-r3-daynight: ' + (e && e.stack || e));
  process.exitCode = 2;
} finally {
  if (handle && handle.close) await handle.close();
}

// SCOPE. `E.ambience.beds` holds twenty beds: the thirteen regions and seven interiors (R4 —
// "interiors get their own bed"). R5 is written about REGIONS ("Marauder's Coast at night has
// drowned-things"), and the round-2 verdict counted 9 of 13 on the regions. The gate is scoped to
// the thirteen so that it measures the claim the item makes; the interiors are reported beside it
// rather than dropped, because "we did not check the interiors" is not the same as "the interiors
// are fine" (rule 26).
const REGION_IDS = JSON.parse(readFileSync(join(ROOT, 'game/data/world/regions.json'), 'utf8'))
  .regions.map((r) => r.id);
const all = Object.keys(out.regions);
const ids = all.filter((id) => REGION_IDS.includes(id));
const interiorIds = all.filter((id) => !REGION_IDS.includes(id));
out.scope = { regions: ids, interiors_not_gated: interiorIds,
  why: 'RI-AUD03 R5 is written about the thirteen regions. Interiors (R4) are measured and reported, not gated.' };
out.interiors = Object.fromEntries(interiorIds.map((id) => [id, {
  identical: out.regions[id].identical, band_distance: out.regions[id].band_distance }]));
const identical = ids.filter((id) => out.regions[id].identical);
// R5b: a SELECTION difference. Either the spectrum moved past the floor, or the scheduler picked
// a different set of event ids. Both are selection facts; neither can be produced by a gain.
const selection = ids.filter((id) => {
  const r = out.regions[id];
  return r.band_distance >= BAND_FLOOR
      || (r.new_at_night && r.new_at_night.length) || (r.gone_at_night && r.gone_at_night.length);
});

out.gates.R5a_night_differs = {
  pass: identical.length === 0,
  value: `${ids.length - identical.length}/${ids.length} regions differ`,
  identical_regions: identical,
  what: 'RI-AUD03 R5. Day and night PCM must not be byte-identical. Nine of thirteen were at round 2.',
};
out.gates.R5b_selection_not_filter = {
  pass: selection.length === ids.length,
  value: `${selection.length}/${ids.length}`,
  filter_only_regions: ids.filter((id) => !selection.includes(id)),
  what: `R5's real claim: night is a different L2/L4 SELECTION. Passes on band_distance >= ${BAND_FLOOR} (level-free) OR a different fired event-id set. A pure gain change scores zero on both.`,
};
out.summary = {
  regions: ids.length,
  identical: identical.length,
  selection_differs: selection.length,
  median_band_distance: (() => {
    const v = ids.map((i) => out.regions[i].band_distance).sort((a, b) => a - b);
    return v.length ? +(v[Math.floor(v.length / 2)]).toFixed(4) : null;
  })(),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');

const fails = Object.entries(out.gates).filter(([, g]) => !g.pass);
for (const [k, g] of Object.entries(out.gates)) {
  console.log(`${g.pass ? 'PASS' : 'FAIL'}  ${k}  ${g.value}`);
}
console.log(`identical day/night: ${identical.length}/${ids.length}${identical.length ? ' — ' + identical.join(', ') : ''}`);
console.log(`wrote ${OUT.replace(ROOT + '/', '')}  (commit ${out.commit}${SABOTAGE ? ', sabotage ' + SABOTAGE : ''})`);
if (process.exitCode === 2) process.exit(2);
process.exit(fails.length ? 1 : 0);
