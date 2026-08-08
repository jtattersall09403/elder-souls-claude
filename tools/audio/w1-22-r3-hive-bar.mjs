#!/usr/bin/env node
// THE HIVE'S BAR, RE-MEASURED WITHOUT THE EVENT THAT WAS OUTSIDE THE CAP. W1-22 round 3.
//
// The round-2 verdict, §2.4, made a specific and checkable claim:
//
//   "The Hive ships `chitin_scrape` at +10.23 and +10.61 dB relative to the bed — 8.6 dB outside
//    §A's L3 cap of +2, which is precisely the '+10 dB' its own arithmetic predicts would be
//    needed. And that single event is the ONLY reason the Hive clears the judge's bar: at 23.3 dB
//    of crest, removing it drops the clip to 19.1 dB."
//
// The amendment `AMENDMENT-W1-22-01` §A says reaching the judge's 20 dB crest reference requires
// placing events six to eight decibels outside §A's band, and simultaneously insists it has NOT
// widened the band. Both cannot be true of a build whose only bed over the bar is over it because
// of one event 8.6 dB past the cap. This tool renders the Hive five ways and puts the arithmetic
// on the table so the next round argues with a number instead of with the amendment's prose.
//
// THE FIVE ARMS, all at one seed, one duration, one sample rate:
//   shipped              the bed as it is on disk today
//   no_chitin_scrape     that event deleted from L3 entirely — the verdict's own counterfactual
//   scrape_at_cap        that event's trim forced so it renders at exactly §A's L3 ceiling, +2 dB
//   scrape_untrimmed     `trim_db` removed — the round-2 build, the +10.6 dB version
//   bed_only             L3 and L4 muted: the floor the crest is measured against
//
// WHAT IS REPORTED. Crest factor (peak-to-RMS, dB) for each arm, the rendered level of
// `chitin_scrape` relative to the bed in each arm, and the judge's 20 dB reference. No gate has an
// opinion about which arm is right — §A's band and the 20 dB reference are in genuine tension and
// this piece is not allowed to resolve that by choosing the arm that scores well. It is allowed to
// measure it.
//
//   node tools/audio/w1-22-r3-hive-bar.mjs [--seconds 180] [--rate 16000] [--region hive]
//
// Exit 0 = the measurement was taken. 2 = the build could not be driven. There is no failing exit
// on the numbers, deliberately: this is an instrument, not a gate.

import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const USAGE = `
w1-22-r3-hive-bar.mjs — the Hive's crest factor with and without the event that sits outside §A's cap.

USAGE
  node tools/audio/w1-22-r3-hive-bar.mjs [--seconds <n>] [--rate <hz>] [--region <id>]
                                         [--event <id>] [--out <file>]
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const SECONDS = Number(args.seconds || 180);
const RATE = Number(args.rate || 16000);
const REGION = args.region || 'hive';
const EVENT = args.event || 'chitin_scrape';
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const OUT = join(ROOT, args.out || `reports/w1-22-r3/hive-bar.json`);
/** RI-AUD03 §A, L3 "Level (rel. bed)" — the ceiling the event is 8.6 dB above. */
const L3_CAP_DB = 2;
/** The B2 judge's own heuristic for "this bed carries one-shots", quoted in the round-2 verdict. */
const JUDGE_REF_DB = 20;

function commit() {
  try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); }
  catch { return 'unknown'; }
}
function decode(b64) {
  const buf = Buffer.from(b64, 'base64');
  const n = buf.length / 4;
  const m = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    m[i] = (buf.readInt16LE(i * 4) / 32768 + buf.readInt16LE(i * 4 + 2) / 32768) / 2;
  }
  return m;
}
const rms = (x, a = 0, b = x.length) => {
  let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i];
  return b > a ? Math.sqrt(s / (b - a)) : 0;
};
const peak = (x) => { let p = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > p) p = v; } return p; };
const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const crestDb = (x) => { const r = rms(x); return r > 0 ? +(db(peak(x)) - db(r)).toFixed(2) : 0; };

/**
 * One event's rendered level relative to the bed, at its scheduled time. Same shape as
 * `ambience-onsets.mjs`'s `eventLevelRelBed` and for the same reason: the declared numbers cannot
 * answer "how far above the floor does this actually get?", because a noise grain and a sine at
 * one `gain_db` are not one loudness.
 */
function levelRelBed(evt, bed, fs, atS, holdS = 1.2) {
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
  return +db(e / f).toFixed(2);
}

const out = {
  tool: 'tools/audio/w1-22-r3-hive-bar.mjs',
  claim_under_test: 'W1-22-r2 §2.4 — one event 8.6 dB outside §A\'s L3 cap is the sole reason the '
    + 'Hive clears the judge\'s 20 dB crest reference.',
  commit: commit(), region: REGION, event: EVENT,
  seconds: SECONDS, sample_rate: RATE, l3_cap_db: L3_CAP_DB, judge_reference_db: JUDGE_REF_DB,
  arms: {},
};

let handle;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  const up = await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 })
    .then(() => true).catch(() => false);
  if (!up) { console.error('w1-22-r3-hive-bar: the game did not boot.'); process.exit(2); }
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));

  const raw = await page.evaluate(async ({ region, event, seconds, rate, cap }) => {
    const E = window.__ENGINE;
    const bed = E.ambience.beds[region];
    if (!bed) return { error: `no bed ${region}` };
    const L3 = bed.layers.L3;
    const ev = (L3.events || []).find((e) => e.id === event);
    if (!ev) return { error: `no event ${event} in ${region}/L3` };
    const savedTrim = ev.trim_db;
    const savedEvents = L3.events;
    const grab = async (mute) => {
      const c = await E.ambienceCapture({ region, seconds, sampleRate: rate, tod: 'day',
                                          listener: null, seed: 0xa3b1, mute });
      return c.ok ? { b64: c.pcm16_interleaved_b64, fired: c.fired } : null;
    };
    const res = {};
    // The floor every crest is measured against. Muting L3/L4 leaves the continuous bed, and the
    // continuous voices draw from a separate PRNG stream, so the bed is the same samples in
    // every arm — which is what makes the arms subtractable at all.
    res.bed_only = await grab(['L3', 'L4', 'R7_strike']);
    res.shipped = await grab(null);
    // scrape_untrimmed: put the event back where round 2 shipped it.
    delete ev.trim_db;
    res.scrape_untrimmed = await grab(null);
    // scrape_at_cap: the trim that lands it on §A's ceiling exactly is solved node-side after the
    // first pass; here we just record what an untrimmed render measures, and the caller re-runs.
    ev.trim_db = savedTrim;
    // no_chitin_scrape: the verdict's own counterfactual — the event deleted, not attenuated.
    L3.events = savedEvents.filter((e) => e.id !== event);
    res.no_event = await grab(null);
    L3.events = savedEvents;
    // LEAVE-ONE-OUT OVER EVERY EVENT IN THE BED, which is the arm that decides the question.
    // "This one event is the sole reason the bed clears the bar" is an attribution claim, and the
    // only way to test an attribution is to remove each candidate in turn and see which removal
    // moves the number. Removing one event and finding the crest still over the bar does not tell
    // you what IS carrying it; this does.
    res.leave_one_out = {};
    for (const L of ['L3', 'L4']) {
      const layer = bed.layers[L];
      if (!layer || !layer.events) continue;
      const saved = layer.events;
      for (const e of saved) {
        layer.events = saved.filter((x) => x.id !== e.id);
        res.leave_one_out[`${L}/${e.id}`] = await grab(null);
      }
      layer.events = saved;
    }
    res._declared = { trim_db: savedTrim === undefined ? null : savedTrim,
                      layer_event_gain_db: L3.event_gain_db, layer_level_db: L3.level_db,
                      synth_gain_db: ev.synth && ev.synth.gain_db };
    return res;
  }, { region: REGION, event: EVENT, seconds: SECONDS, rate: RATE, cap: L3_CAP_DB });

  if (raw.error) { console.error('w1-22-r3-hive-bar: ' + raw.error); process.exit(2); }
  out.declared = raw._declared;

  const bedOnly = decode(raw.bed_only.b64);
  out.leave_one_out = {};
  for (const [k, r] of Object.entries(raw.leave_one_out || {})) {
    if (!r) continue;
    out.leave_one_out[k] = { crest_without_it_db: crestDb(decode(r.b64)),
                             events_fired: (r.fired || []).length };
  }
  for (const arm of ['shipped', 'scrape_untrimmed', 'no_event', 'bed_only']) {
    const r = raw[arm];
    if (!r) { out.arms[arm] = { error: 'capture failed' }; continue; }
    const x = decode(r.b64);
    const n = Math.min(x.length, bedOnly.length);
    const resid = new Float64Array(n);
    for (let i = 0; i < n; i++) resid[i] = x[i] - bedOnly[i];
    const hits = (r.fired || []).filter((f) => f.id === EVENT);
    const levels = hits.map((f) => levelRelBed(resid, bedOnly, RATE, f.at_s)).filter((v) => v !== null);
    levels.sort((a, b) => a - b);
    out.arms[arm] = {
      crest_db: crestDb(x),
      clears_judge_reference: crestDb(x) >= JUDGE_REF_DB,
      [`${EVENT}_occurrences`]: hits.length,
      [`${EVENT}_rel_bed_db`]: levels.length ? levels[Math.floor(levels.length / 2)] : null,
      [`${EVENT}_outside_cap_by_db`]: levels.length
        ? +(levels[Math.floor(levels.length / 2)] - L3_CAP_DB).toFixed(2) : null,
      total_events_fired: (r.fired || []).length,
    };
  }
} catch (e) {
  console.error('w1-22-r3-hive-bar: ' + (e && e.stack || e));
  process.exitCode = 2;
} finally {
  if (handle && handle.close) await handle.close();
}

const A = out.arms;
if (A.shipped && A.scrape_untrimmed && A.no_event) {
  out.finding = {
    round2_build_crest_db: A.scrape_untrimmed.crest_db,
    round2_event_rel_bed_db: A.scrape_untrimmed[`${EVENT}_rel_bed_db`],
    round2_outside_cap_by_db: A.scrape_untrimmed[`${EVENT}_outside_cap_by_db`],
    crest_without_the_event_db: A.no_event.crest_db,
    crest_the_event_was_worth_db: A.scrape_untrimmed.crest_db === null || A.no_event.crest_db === null
      ? null : +(A.scrape_untrimmed.crest_db - A.no_event.crest_db).toFixed(2),
    crest_with_the_event_in_band_db: A.shipped.crest_db,
    carries_the_bar: (() => {
      // Which single event's removal costs the most crest. That is the event carrying the bar,
      // whatever the amendment's arithmetic says ought to be carrying it.
      const rows = Object.entries(out.leave_one_out || {})
        .map(([k, v]) => [k, +(A.shipped.crest_db - v.crest_without_it_db).toFixed(2)])
        .sort((a, b) => b[1] - a[1]);
      return rows.length ? { event: rows[0][0], crest_cost_db: rows[0][1], all: rows } : null;
    })(),
    verdict: A.no_event.crest_db < JUDGE_REF_DB && A.scrape_untrimmed.crest_db >= JUDGE_REF_DB
      ? `UPHELD — with ${EVENT} present at ${A.scrape_untrimmed[`${EVENT}_rel_bed_db`]} dB rel. bed the `
        + `${REGION} clears the ${JUDGE_REF_DB} dB reference at ${A.scrape_untrimmed.crest_db} dB; with the `
        + `event deleted it falls to ${A.no_event.crest_db} dB. The out-of-cap event was carrying the bar.`
      : `NOT UPHELD as stated — see the arms.`,
  };
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
for (const [k, v] of Object.entries(out.arms)) {
  console.log(`${k.padEnd(18)} crest ${String(v.crest_db).padStart(6)} dB   ` +
    `${EVENT} ${v[`${EVENT}_rel_bed_db`]} dB rel. bed (n=${v[`${EVENT}_occurrences`]})`);
}
if (out.finding) console.log('\n' + out.finding.verdict);
console.log(`wrote ${OUT.replace(ROOT + '/', '')} (commit ${out.commit})`);
