#!/usr/bin/env node
// DOES THE SAME BED RENDER THE SAME SOUND TWICE?  W1-22 round 3.  RI-AUD03 R3.
//
// R3 is the rule this piece gives up a permission for. HARNESS.md §8 lets non-simulation code use
// unseeded randomness; RI-AUD03 R3 declines it, in its own words, so that "two runs of the same
// scenario produce the same ambience" — because otherwise "audioLog diverges between runs and the
// blind pack is not reproducible". Every blind measurement of this piece (B1, B2, B3) is a
// comparison between recordings. If a recording is not a function of the scenario, the comparison
// is measuring the renderer's mood, and no amount of level work underneath it means anything.
//
// The round-2 builder found and did not root-cause the defect this tool exists for: two of the
// seven new interior beds, `street` and `well`, did not render reproducibly at a fixed seed, with
// NO PERTURBATION AT ALL between the two captures. It recorded that plainly and handed it over as
// the top item. This is the instrument that reproduces it, localises it, and stays behind as the
// fence.
//
// WHAT IS CHECKED
//
//   D1  BIT IDENTITY. Capture each bed `--repeat` times, back to back, in one page, with
//       identical arguments and nothing touched in between. Every capture must be byte-for-byte
//       the same PCM. This is the literal reading of R3 and it is the one that a blind pack rests
//       on.
//
//   D2  ORDER INDEPENDENCE. Capture bed A, then every other bed, then bed A again. A render that
//       depends on what was rendered before it is reproducible only by accident — it would hold
//       inside one pack builder and break the moment a pack was rebuilt in a different order.
//
//   D3  LOCALISATION, run only for beds that failed D1. The same bed is re-captured twice with
//       `mute: ['L3','L4','R7']` (the continuous bed alone) and twice with `mute: ['L1','L2']`
//       (the event grains alone). Whichever arm is unstable holds the defect. This uses the mute
//       path `renderBedOffline` already has, so it measures the shipping renderer rather than a
//       second copy of it.
//
// WHEN A CAPTURE PAIR DIFFERS, the difference is DESCRIBED and not merely counted: first
// differing sample (and therefore first differing second), how many samples differ, and the
// largest difference in 16-bit LSBs. Those three numbers separate the three things this could be
// — one event landing at a different time (a late, large, localised difference), the whole render
// shifted (differs from sample 0, small, everywhere), or a tail that decays differently.
//
// FALSIFIABILITY (RULES.md rule 4). `--sabotage gain` adds Math.random()*0.01 dB to the bed's
// master trim before each capture and restores it after — an unseeded quantity leaking into the
// render, which is exactly the class of defect D1 exists to catch, at a size (about 0.01 dB, ~4
// LSB at ordinary bed levels) far below anything a listener could hear. D1 must go RED for every
// bed under that arm. If it does not, the check is a check that cannot fail and no green from it
// is worth anything. Nothing is written to disk by the sabotage arm.
//
//   node tools/analysis/ambience-determinism.mjs [--seconds 8] [--rate 16000] [--repeat 3]
//                                               [--beds a,b,c] [--tod day|night|both]
//                                               [--sabotage gain] [--json]
//
// Exit 0 = every check passed. 1 = a check failed. 2 = the build could not be driven.

import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const USAGE = `ambience-determinism.mjs — does the same bed render the same sound twice? (RI-AUD03 R3)

  --seconds N     render length per capture (default 8)
  --rate HZ       render sample rate (default 16000)
  --repeat N      captures per bed per tod (default 3)
  --beds a,b,c    only these beds (default: every bed the engine loaded)
  --tod X         day | night | both (default both)
  --sabotage gain FALSIFIER: leak Math.random()*0.01 dB into the master trim before each
                  capture. D1 must go red for every bed. Writes no report.
  --json          print the whole report
`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const SECONDS = Number(args.seconds || 8);
const RATE = Number(args.rate || 16000);
const REPEAT = Math.max(2, Number(args.repeat || 3));
const TOD = String(args.tod || 'both');
const TODS = TOD === 'both' ? ['day', 'night'] : [TOD];
const SABOTAGE = args.sabotage ? String(args.sabotage) : null;
const ONLY = args.beds ? String(args.beds).split(',').map((s) => s.trim()).filter(Boolean) : null;
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

function gitStamp() {
  try {
    const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { commit: sh('git rev-parse --short HEAD'), dirty: sh('git status --porcelain') !== '' };
  } catch { return {}; }
}

/**
 * Describe HOW two captures differ, not just that they do. The three numbers below are what
 * separate "one grain moved" from "every sample is a hair different" from "a tail decayed
 * differently", and the round-2 handoff could not say which of the three it had.
 */
function describeDiff(b64a, b64b, rate) {
  if (b64a === b64b) return null;
  const A = Buffer.from(b64a, 'base64'), B = Buffer.from(b64b, 'base64');
  if (A.length !== B.length) return { kind: 'length', a_bytes: A.length, b_bytes: B.length };
  let first = -1, differing = 0, maxAbs = 0;
  const n = A.length >> 1;                       // 16-bit samples, stereo interleaved
  for (let i = 0; i < n; i++) {
    const a = A.readInt16LE(i * 2), b = B.readInt16LE(i * 2);
    if (a !== b) {
      if (first < 0) first = i;
      differing++;
      const d = Math.abs(a - b);
      if (d > maxAbs) maxAbs = d;
    }
  }
  return {
    kind: 'samples',
    first_differing_sample: first,
    first_differing_s: +(first / 2 / rate).toFixed(4),   // /2 for the two interleaved channels
    differing_samples: differing,
    differing_fraction: +(differing / n).toFixed(6),
    max_abs_lsb: maxAbs,
    max_abs_db_fs: +(20 * Math.log10(Math.max(1, maxAbs) / 32767)).toFixed(2),
  };
}
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

const out = {
  tool: 'tools/analysis/ambience-determinism.mjs', taken_at: new Date().toISOString(),
  git: gitStamp(), seconds: SECONDS, sample_rate: RATE, repeat: REPEAT, tods: TODS,
  sabotage: SABOTAGE, beds: {}, checks: {}, notes: [],
};
let handle, exitCode = 0;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));

  // DELETE-THE-FIX (RULES.md rule 6). `flatmix` puts the shipping renderer back on the round-2
  // mixing topology — every voice straight onto the bus — on this tree, at this commit, with no
  // file edited and nothing staged (rule 17). D1 must go red for the two beds it went red for
  // before the fix, or the fix is inert and the green means nothing.
  if (SABOTAGE === 'flatmix') await page.evaluate(() => { globalThis.__ES_AUDIO_FLAT_MIX = true; });

  // ---- D0: IS THIS EVEN OURS? -----------------------------------------------------------------
  //
  // RULES.md rule 10 — confirm the code you are about to change is actually the code responsible.
  // Before a single line of `synth.js` is touched, render graphs that contain NO Elder Souls code
  // whatsoever: bare OscillatorNodes and GainNodes in an OfflineAudioContext, twice each,
  // byte-compared. If those diverge, the defect is the platform's floating-point dispatch and no
  // change to the bed data or the synthesiser can fix it — and a remedy aimed at our code would
  // be a fix for a cause that was never there.
  //
  // The ladder is by SOURCE COUNT because D3 pointed at summation: `well`'s L1 (four oscillators
  // into one gain) is unstable alone, `street`'s L1 (one noise source) is stable alone and only
  // becomes unstable once three layers sum into the bus.
  const d0 = await page.evaluate(async (rate) => {
    const Ctor = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (typeof Ctor !== 'function') return { ok: false, why: 'no OfflineAudioContext' };
    const render = async (nOsc, seconds, chained) => {
      const ctx = new Ctor(2, Math.ceil(seconds * rate), rate);
      const sum = ctx.createGain();
      sum.gain.value = 0.2;
      sum.connect(ctx.destination);
      let acc = null;
      for (let i = 0; i < nOsc; i++) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 43.65 * (i + 1) + 0.37 * i;   // irrational-ish spacing, as a real chord
        o.detune.value = (i % 2 === 0 ? 3 : -3);
        const g = ctx.createGain();
        g.gain.value = Math.pow(10, (-6 - 6 * i) / 20);
        o.connect(g);
        if (!chained) g.connect(sum);
        else if (acc === null) acc = g;
        else {
          // THE CANDIDATE REMEDY, tested here before it is written into the synthesiser: a
          // left-leaning chain of unity gains, so that no node ever receives more than TWO
          // connections and the summation order is fixed by the graph rather than by the heap.
          const j = ctx.createGain(); j.gain.value = 1;
          acc.connect(j); g.connect(j); acc = j;
        }
        o.start(0);
      }
      if (chained && acc) acc.connect(sum);
      const buf = await ctx.startRendering();
      const c = buf.getChannelData(0);
      let s = '';
      for (let i = 0; i < c.length; i++) s += c[i].toExponential(9) + ',';
      // A cheap content hash of the exact float bits, so "identical" means identical.
      let h = 2166136261 >>> 0;
      for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
      return { hash: h, data: c };
    };
    const rows = [];
    for (const chained of [false, true]) {
      for (const n of [1, 2, 3, 4, 8]) {
        const a = await render(n, 2, chained), b = await render(n, 2, chained);
        let maxd = 0, nz = 0;
        for (let i = 0; i < a.data.length; i++) {
          const d = Math.abs(a.data[i] - b.data[i]);
          if (d > 0) { nz++; if (d > maxd) maxd = d; }
        }
        rows.push({ arm: chained ? 'chained (<=2 inputs per node)' : 'flat (n inputs on one node)',
                    oscillators: n, identical: a.hash === b.hash && nz === 0,
                    nonzero_samples: nz, samples: a.data.length, max_abs: maxd });
      }
    }
    return { ok: true, rows };
  }, RATE);
  // The control is NOT expected to be all-green: the `flat` arm is the defect, reproduced with no
  // Elder Souls code in it, and the `chained` arm is the remedy. What must hold is that the two
  // arms DIFFER — a control where both arms behave the same would tell us nothing about either.
  out.checks.D0_platform_control = {
    pass: d0.ok && d0.rows.filter((r) => r.arm && r.arm.startsWith('chained')).every((r) => r.identical)
          && d0.rows.some((r) => r.arm && r.arm.startsWith('flat') && !r.identical),
    rows: d0.rows || [],
    what: 'CONTROL, no Elder Souls code: bare OscillatorNode/GainNode graphs rendered twice in an '
      + 'OfflineAudioContext and compared in the float domain. A failure here means the '
      + 'non-determinism is the platform\'s, not the bed\'s, and locates the remedy accordingly.',
  };
  if (args['only-control']) {
    console.log(JSON.stringify(out.checks.D0_platform_control, null, 2));
    await handle.close();
    process.exit(out.checks.D0_platform_control.pass ? 0 : 1);
  }

  const bedIds = await page.evaluate(() => Object.keys(window.__ENGINE.ambience.beds));
  const beds = ONLY ? bedIds.filter((b) => ONLY.includes(b)) : bedIds;
  if (!beds.length) { console.error('no beds selected'); process.exit(2); }
  out.beds_loaded = bedIds.length;
  out.beds_measured = beds;

  // ---- D1 / D2: the captures -----------------------------------------------------------------
  //
  // One page.evaluate per (bed, tod) so a hung render cannot take the whole run with it, and so
  // the browser is launched exactly once (RULES.md rule 21).
  const capture = (bed, tod, mute, n) => page.evaluate(async (a) => {
    const E = window.__ENGINE;
    const b = E.ambience.beds[a.bed];
    const saved = b.bed_gain_db;
    const hashes = [];
    for (let i = 0; i < a.n; i++) {
      // FALSIFIER. An unseeded quantity in the render path, restored immediately, so the only
      // thing that changed between two captures is something no scenario declares.
      if (a.sabotage === 'gain') b.bed_gain_db = (saved || 0) + Math.random() * 0.01;
      const c = await E.ambienceCapture({
        region: a.bed, seconds: a.seconds, sampleRate: a.rate, tod: a.tod,
        listener: null, mute: a.mute && a.mute.length ? a.mute : undefined,
      });
      if (!c.ok) return { ok: false, why: c.why };
      hashes.push({ b64: c.pcm16_interleaved_b64, samples: c.samples,
                    fired: (c.fired || []).map((f) => `${f.layer}:${f.id}@${f.at_s}`) });
    }
    b.bed_gain_db = saved;
    return { ok: true, caps: hashes };
  }, { bed, tod, mute, n, seconds: SECONDS, rate: RATE, sabotage: SABOTAGE });

  const d1 = [], d2 = [], d3 = [];
  const firstCap = {};                          // for D2: bed|tod -> b64 of the very first capture

  for (const tod of TODS) {
    for (const bed of beds) {
      const key = `${bed}|${tod}`;
      const r = await capture(bed, tod, null, REPEAT);
      if (!r.ok) { out.notes.push(`${key}: ${r.why}`); d1.push(`${key}: capture failed (${r.why})`); continue; }
      const rec = out.beds[key] = { bed, tod, samples: r.caps[0].samples,
                                    digest: sha(r.caps[0].b64),
                                    fired: r.caps[0].fired.length,
                                    identical: true, diffs: [] };
      firstCap[key] = r.caps[0].b64;
      for (let i = 1; i < r.caps.length; i++) {
        const d = describeDiff(r.caps[0].b64, r.caps[i].b64, RATE);
        if (d) {
          rec.identical = false;
          rec.diffs.push({ capture: i, ...d });
          // A capture whose EVENT SCHEDULE moved is a different defect from one whose samples
          // moved, so say which. `fired` comes out of the renderer, not out of a re-derivation.
          if (r.caps[i].fired.join('|') !== r.caps[0].fired.join('|')) {
            rec.schedule_moved = true;
            rec.fired_0 = r.caps[0].fired;
            rec.fired_i = r.caps[i].fired;
          }
        }
      }
      if (!rec.identical) d1.push(`${key}: capture 1 and ${rec.diffs.map((x) => x.capture + 1).join('/')} differ`
        + ` (first at ${rec.diffs[0].first_differing_s}s, ${rec.diffs[0].differing_samples} samples, max ${rec.diffs[0].max_abs_lsb} LSB)`);
    }
  }

  // ---- D2: the same bed again, after every other bed has rendered ----------------------------
  if (beds.length > 1) {
    for (const tod of TODS) {
      const bed = beds[0], key = `${bed}|${tod}`;
      if (!firstCap[key]) continue;
      const r = await capture(bed, tod, null, 1);
      if (!r.ok) { d2.push(`${key}: re-capture failed (${r.why})`); continue; }
      const d = describeDiff(firstCap[key], r.caps[0].b64, RATE);
      out.beds[key].order_independent = !d;
      if (d) { out.beds[key].order_diff = d; d2.push(`${key}: differs from its own first capture after ${beds.length - 1} other beds rendered`); }
    }
  }

  // ---- D3: localise, for the beds D1 caught ---------------------------------------------------
  //
  // A ladder rather than a split, because "the continuous bed is unstable" is not yet an address.
  // Each arm leaves exactly one part of the renderer standing.
  const failed = Object.values(out.beds).filter((b) => !b.identical);
  for (const f of failed) {
    const arms = {
      L1_alone: ['L2', 'L3', 'L4', 'R7'],
      L2_alone: ['L1', 'L3', 'L4', 'R7'],
      bed_only: ['L3', 'L4', 'R7'],
      events_only: ['L1', 'L2'],
    };
    f.localisation = {};
    for (const [name, mute] of Object.entries(arms)) {
      const r = await capture(f.bed, f.tod, mute, 2);
      if (!r.ok) { f.localisation[name] = { ok: false, why: r.why }; continue; }
      const d = describeDiff(r.caps[0].b64, r.caps[1].b64, RATE);
      f.localisation[name] = { muted: mute, identical: !d, diff: d };
    }
    const unstable = Object.entries(f.localisation).filter(([, v]) => v.identical === false).map(([k]) => k);
    f.defect_in = unstable.length ? unstable : ['neither arm alone — the instability needs both'];
    d3.push(`${f.bed}|${f.tod}: unstable in ${f.defect_in.join(' + ')}`);

    // HOW BIG IS THE DIVERGENCE REALLY? The 16-bit capture can only report "1 LSB", which is a
    // fact about the quantiser, not about the renderer: a float difference of 1e-9 flips exactly
    // those samples that happened to sit within 1e-9 of a rounding boundary. So take the same
    // pair again in the FLOAT domain and measure it directly. This is the number that says
    // whether the defect is a scheduling divergence (order 1e-1) or a summation-order one
    // (order 1e-9), and they have completely different remedies.
    const fl = await page.evaluate(async (a) => {
      const E = window.__ENGINE;
      const one = () => E.ambienceCapture({ region: a.bed, seconds: a.seconds, sampleRate: a.rate,
                                            tod: a.tod, listener: null, arrays: true });
      const c0 = await one(), c1 = await one();
      if (!c0.ok || !c1.ok) return { ok: false };
      let maxL = 0, maxR = 0, nz = 0, firstNz = -1;
      for (let i = 0; i < c0.L.length; i++) {
        const dl = Math.abs(c0.L[i] - c1.L[i]), dr = Math.abs(c0.R[i] - c1.R[i]);
        if (dl > maxL) maxL = dl;
        if (dr > maxR) maxR = dr;
        if (dl !== 0 || dr !== 0) { nz++; if (firstNz < 0) firstNz = i; }
      }
      return { ok: true, samples: c0.L.length, max_abs_L: maxL, max_abs_R: maxR,
               nonzero_samples: nz, first_nonzero_sample: firstNz };
    }, { bed: f.bed, tod: f.tod, seconds: Math.min(SECONDS, 4), rate: RATE });
    if (fl.ok) {
      f.float_divergence = {
        ...fl,
        max_abs: Math.max(fl.max_abs_L, fl.max_abs_R),
        max_abs_db_fs: +(20 * Math.log10(Math.max(1e-30, Math.max(fl.max_abs_L, fl.max_abs_R)))).toFixed(1),
        nonzero_fraction: +(fl.nonzero_samples / Math.max(1, fl.samples)).toFixed(6),
      };
    }
  }

  const sab = SABOTAGE === 'gain';
  out.checks.D1_bit_identical = {
    pass: sab ? d1.length === Object.keys(out.beds).length
        : SABOTAGE === 'flatmix' ? d1.length > 0
        : d1.length === 0,
    failures: d1,
    what: sab
      ? 'FALSIFIER ARM: with Math.random()*0.01 dB leaking into the master trim, EVERY bed must fail D1. A pass here means the check cannot fail.'
      : SABOTAGE === 'flatmix'
        ? 'DELETE-THE-FIX ARM: with the round-2 flat mixing topology restored, D1 must go red again. A green here means the deterministic mixer is not what made the difference.'
        : 'RI-AUD03 R3. The same bed, captured repeatedly with identical arguments and nothing touched in between, renders byte-for-byte the same PCM.',
  };
  out.checks.D2_order_independent = { pass: d2.length === 0, failures: d2,
    what: 'A render must not depend on what was rendered before it — a pack rebuilt in a different order would not match.' };
  out.checks.D3_localisation = { pass: true, findings: d3,
    what: 'Not a gate. For every bed D1 caught, which half of the renderer is unstable: the continuous bed, the event grains, or only the two together.' };
  for (const c of Object.values(out.checks)) if (!c.pass) exitCode = 1;
} finally {
  if (handle) await handle.close();
}

// The sabotage arms write too, under a suffixed name — a delete-the-fix that leaves no artifact
// behind cannot be re-read by a critic, and the flat arm is the "before" half of every claim in
// this piece about the mixer. It cannot overwrite the clean baseline because the name differs.
{
  const outPath = args.out
    || join(ROOT, `reports/w1-22/ambience-determinism${SABOTAGE ? '-sab-' + SABOTAGE : ''}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  out.report_path = outPath;
}
if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`ambience-determinism @ ${out.git.commit}${out.git.dirty ? ' (dirty)' : ''}`
    + ` — ${out.beds_measured.length} beds x ${TODS.length} tod x ${REPEAT} captures, ${SECONDS}s @ ${RATE} Hz`
    + (SABOTAGE ? `  [SABOTAGE ${SABOTAGE}]` : ''));
  for (const [k, b] of Object.entries(out.beds)) {
    const mark = b.identical ? 'same' : 'DIFFERS';
    console.log(`  ${k.padEnd(26)} ${mark.padEnd(8)} ${b.digest}`
      + (b.identical ? '' : `  first@${b.diffs[0].first_differing_s}s  n=${b.diffs[0].differing_samples}  max=${b.diffs[0].max_abs_lsb} LSB`
          + (b.schedule_moved ? '  SCHEDULE MOVED' : ''))
      + (b.defect_in ? `  -> ${b.defect_in.join(' + ')}` : ''));
  }
  for (const [k, c] of Object.entries(out.checks)) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${k}${c.pass ? '' : ' — ' + (c.failures || []).slice(0, 6).join('; ')}`);
    if (k === 'D3_localisation' && c.findings.length) for (const f of c.findings) console.log(`        ${f}`);
  }
  for (const b of Object.values(out.beds)) {
    if (b.float_divergence) {
      const d = b.float_divergence;
      console.log(`        ${b.bed}|${b.tod} float divergence: max ${d.max_abs.toExponential(3)}`
        + ` (${d.max_abs_db_fs} dBFS), ${d.nonzero_samples}/${d.samples} samples,`
        + ` first at sample ${d.first_nonzero_sample}`);
    }
  }
  if (out.report_path) console.log(`report: ${out.report_path}`);
}
process.exit(exitCode);
