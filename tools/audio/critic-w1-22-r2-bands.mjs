#!/usr/bin/env node
// WRITTEN BY THE W1-22 ROUND-2 CRITIC (round-3 judgement). Declared under `method_deviations`.
//
// WHAT THIS ASKS THAT THE SHIPPED GATE DOES NOT.
//
// `tools/analysis/ambience-onsets.mjs` gate O3 checks that each bed/layer's event level sits in
// RI-AUD03 §A's band (L3 -6..+2, L4 -4..+4, ±2 tolerance). It checks the MEDIAN of the layer's
// events. The fix it grades — `event_gain_db` — is ALSO a single per-layer number. So the trim
// and the gate are calibrated to the same statistic, and neither can see an individual event.
// A layer whose events straddle the band by ±10 dB has a median dead centre and passes.
//
// That matters because the defect this piece exists to fix is "declared in band, buried by a
// second gain stage". The second stage (`synth.gain_db`, -5..-13 per event) varies PER EVENT
// while the corrective trim is PER LAYER. A per-layer trim cannot, in principle, unbury an event
// that is quieter than its layer-mates; it can only move the whole spread up or down. Whether it
// did is an empirical question and this tool answers it.
//
// THREE CHECKS, over an `ambience-onsets.mjs` report (no browser, no engine):
//
//   B1  EVERY MEASURED EVENT — not the layer median — sits inside §A's band with the same ±2 dB
//       tolerance O3 declares. This is O3's own sentence ("EVERY bed's measured event level")
//       enforced on events rather than on a statistic over them.
//   B2  DECLARED-CHAIN FIDELITY. level_db + synth.gain_db + event_gain_db, read from
//       game/data/audio/ambience/**, must predict the RENDERED rel_db within ±3 dB. This is the
//       end-to-end gain-staging check: it reads the numbers a designer types and compares them to
//       the sound that came out. "Loudness is not the sum of the numbers you typed" is the
//       piece's own diagnosis; this is the measurement of how far off the sum still is.
//   B3  THE AMENDMENT-W1-22-01 §A ARITHMETIC, redone from the data instead of from an assumption.
//       §A argues the B2 judge's 20 dB crest bar and §A's level band cannot both be satisfied,
//       via "a short grain carries 6-10 dB of its own peak-to-RMS". That figure is not assumed
//       here: it is MEASURED, per event, as (peak_dbfs - bed_rms_dbfs) - rel_db, and the required
//       event level to reach 20 dB of crest is recomputed from the measured distribution.
//
// FALSIFICATION (rule 4). `--sabotage widen` multiplies every measured rel_db away from the band
// centre by 3, which must take B1 red on beds that currently pass. `--sabotage centre` collapses
// every event onto its layer median, which is the shape O3 can already see — B1 must go GREEN on
// that, proving B1's reading is about the SPREAD and not about the level. A check that stayed red
// under `centre` would be measuring something else.
//
//   node tools/audio/critic-w1-22-r2-bands.mjs [--report <onsets.json>] [--out <file>]
//   node tools/audio/critic-w1-22-r2-bands.mjs --sabotage widen|centre
//
// Exit 0 = every check passed. 1 = a check failed. 2 = the report could not be read.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const args = Object.fromEntries(process.argv.slice(2).flatMap((a, i, all) =>
  a.startsWith('--') ? [[a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : []));

const BANDS = { L3: [-6, 2], L4: [-4, 4] };
const TOL_DB = 2;              // the tolerance ambience-onsets.mjs itself declares
const CHAIN_TOL_DB = 3;        // B2: how far the typed numbers may miss the rendered level
const JUDGE_CREST_DB = 20;     // the B2 blind judge's heuristic bar
const SAB = args.sabotage || null;
if (SAB && !['widen', 'centre'].includes(SAB)) {
  console.error(`critic-w1-22-r2-bands: --sabotage must be 'widen' or 'centre', got ${JSON.stringify(SAB)}`);
  process.exit(2);
}

const reportPath = args.report
  ? String(args.report)
  : join(ROOT, 'reports', 'w1-22-critic', 'r2', 'onsets-at-HEAD.json');
if (!existsSync(reportPath)) {
  console.error(`critic-w1-22-r2-bands: no onsets report at ${reportPath}.\n`
    + '  This tool measures a render; it does not fabricate one. Produce the report first:\n'
    + '    node tools/analysis/ambience-onsets.mjs --seconds 180 --out <path>');
  process.exit(2);
}
const rep = JSON.parse(readFileSync(reportPath, 'utf8'));

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}
function quantile(xs, q) {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const i = Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))));
  return s[i];
}
const r2 = (x) => Math.round(x * 100) / 100;

// ---- the declared gain chain, read from the shipped data ----------------------------------
const decl = new Map();          // `${bed}|${layer}|${eventId}` -> {level_db, gain_db, event_gain_db}
function readBeds(dir) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    let bed;
    try { bed = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    const bid = bed.id || f.replace(/\.json$/, '');
    for (const [lname, L] of Object.entries(bed.layers || {})) {
      if (!BANDS[lname] || !L || typeof L !== 'object') continue;
      const trim = L.event_gain_db || 0;
      const lvl = L.level_db || 0;
      const take = (o) => {
        for (const e of (o.events || [])) {
          if (!e || !e.id) continue;
          decl.set(`${bid}|${lname}|${e.id}`,
            { level_db: lvl, gain_db: (e.synth || {}).gain_db || 0, event_gain_db: trim });
        }
      };
      take(L);
      for (const s of (L.sublayers || [])) if (s && typeof s === 'object') take(s);
    }
  }
}
readBeds(join(ROOT, 'game/data/audio/ambience'));
readBeds(join(ROOT, 'game/data/audio/ambience/interiors'));

// ---- flatten the report into one row per measured event ------------------------------------
const events = [];
const beds = [];
for (const [bid, rec] of Object.entries(rep.regions || {})) {
  if (!rec || !rec.tod) continue;
  for (const [tod, t] of Object.entries(rec.tod)) {
    if (!t || t.error) continue;
    beds.push({ bed: bid, tod, kind: rec.kind, crest: t.crest_factor_db,
                bed_crest: t.crest_factor_bed_only_db, bed_rms: t.bed_rms_dbfs,
                scheduled: t.scheduled, detected: t.onsets_detected });
    for (const e of (t.events || [])) {
      if (!BANDS[e.layer]) continue;
      events.push({ bed: bid, tod, layer: e.layer, id: e.id, rel_db: e.rel_db,
                    peak_dbfs: e.peak_dbfs, bed_rms: t.bed_rms_dbfs });
    }
  }
}
if (!events.length) {
  console.error('critic-w1-22-r2-bands: the report contains no measured events at all. '
    + 'Nothing here can be checked and a green would be vacuous. Refusing to report.');
  process.exit(2);
}

// ---- sabotage arms, applied to the measured levels ------------------------------------------
if (SAB) {
  const byLayer = new Map();
  for (const e of events) {
    const k = `${e.bed}|${e.layer}`;
    if (!byLayer.has(k)) byLayer.set(k, []);
    byLayer.get(k).push(e.rel_db);
  }
  const meds = new Map([...byLayer].map(([k, xs]) => [k, median(xs)]));
  for (const e of events) {
    const m = meds.get(`${e.bed}|${e.layer}`);
    // `widen` triples every event's distance from its own layer median (spread x3, median fixed).
    // `centre` collapses every event onto that median (spread 0, median fixed).
    e.rel_db = SAB === 'widen' ? m + (e.rel_db - m) * 3 : m;
  }
}

const out = {
  tool: 'tools/audio/critic-w1-22-r2-bands.mjs',
  taken_at: new Date().toISOString(),
  reads_report: reportPath.replace(ROOT + '/', ''),
  report_taken_at: rep.taken_at || null,
  report_commit: (rep.git || {}).commit || null,
  report_seconds: rep.seconds || null,
  git: (() => {
    try {
      return { commit: execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
               dirty: execSync('git status --porcelain', { cwd: ROOT }).toString().trim().length > 0 };
    } catch { return { commit: null, dirty: null }; }
  })(),
  sabotage: SAB,
  n_events: events.length,
  n_bed_tod: beds.length,
  checks: {},
};

// ---- B1: every event in band, not the layer median ------------------------------------------
{
  const outOfBand = [];
  for (const e of events) {
    const [lo, hi] = BANDS[e.layer];
    if (e.rel_db < lo - TOL_DB) outOfBand.push({ ...e, rel_db: r2(e.rel_db), how: 'BURIED', by_db: r2((lo - TOL_DB) - e.rel_db) });
    else if (e.rel_db > hi + TOL_DB) outOfBand.push({ ...e, rel_db: r2(e.rel_db), how: 'SHOUTING', by_db: r2(e.rel_db - (hi + TOL_DB)) });
  }
  // How many bed/layer pairs pass O3's median reading while containing an out-of-band event?
  const byLayer = new Map();
  for (const e of events) {
    const k = `${e.bed}|${e.layer}`;
    if (!byLayer.has(k)) byLayer.set(k, []);
    byLayer.get(k).push(e);
  }
  let hiddenPairs = 0;
  const hidden = [];
  for (const [k, xs] of byLayer) {
    const layer = k.split('|')[1];
    const [lo, hi] = BANDS[layer];
    const m = median(xs.map((e) => e.rel_db));
    const medianOk = m >= lo - TOL_DB && m <= hi + TOL_DB;
    const bad = xs.filter((e) => e.rel_db < lo - TOL_DB || e.rel_db > hi + TOL_DB);
    if (medianOk && bad.length) {
      hiddenPairs++;
      const worst = bad.reduce((a, b) => (Math.abs(b.rel_db - m) > Math.abs(a.rel_db - m) ? b : a));
      hidden.push({ bed: k.split('|')[0], layer, median_rel_db: r2(m), n: xs.length,
                    n_out_of_band: bad.length, worst_event: worst.id, worst_rel_db: r2(worst.rel_db) });
    }
  }
  // The spread a single per-layer trim cannot remove: between DIFFERENT event ids in one layer.
  const spreads = [];
  for (const [k, xs] of byLayer) {
    const byId = new Map();
    for (const e of xs) {
      if (!byId.has(e.id)) byId.set(e.id, []);
      byId.get(e.id).push(e.rel_db);
    }
    if (byId.size < 2) continue;
    const meds = [...byId].map(([id, v]) => ({ id, med: median(v) }));
    const hiE = meds.reduce((a, b) => (b.med > a.med ? b : a));
    const loE = meds.reduce((a, b) => (b.med < a.med ? b : a));
    spreads.push({ bed: k.split('|')[0], layer: k.split('|')[1], spread_db: r2(hiE.med - loE.med),
                   loudest: `${hiE.id}@${r2(hiE.med)}`, quietest: `${loE.id}@${r2(loE.med)}` });
  }
  spreads.sort((a, b) => b.spread_db - a.spread_db);
  out.checks.B1_every_event_in_band = {
    pass: outOfBand.length === 0,
    n_out_of_band: outOfBand.length,
    of_n_events: events.length,
    buried: outOfBand.filter((e) => e.how === 'BURIED').length,
    shouting: outOfBand.filter((e) => e.how === 'SHOUTING').length,
    worst: outOfBand.sort((a, b) => b.by_db - a.by_db).slice(0, 10),
    o3_median_blind_pairs: hiddenPairs,
    o3_median_blind: hidden.sort((a, b) => Math.abs(b.worst_rel_db) - Math.abs(a.worst_rel_db)),
    between_event_spread_db: {
      n_multi_event_layers: spreads.length,
      median: spreads.length ? r2(median(spreads.map((s) => s.spread_db))) : null,
      worst: spreads.slice(0, 8),
    },
    what: `EVERY measured event sits inside RI-AUD03 §A's band (L3 ${BANDS.L3}, L4 ${BANDS.L4}) `
      + `within the ±${TOL_DB} dB tolerance ambience-onsets.mjs declares — checked per EVENT, not `
      + 'over the layer median that gate O3 and the per-layer `event_gain_db` trim both use.',
  };
}

// ---- B2: does the declared chain predict the rendered level? --------------------------------
{
  const rows = [];
  const byId = new Map();
  for (const e of events) {
    const k = `${e.bed}|${e.layer}|${e.id}`;
    if (!byId.has(k)) byId.set(k, []);
    byId.get(k).push(e.rel_db);
  }
  for (const [k, xs] of byId) {
    const d = decl.get(k);
    if (!d) continue;
    const predicted = d.level_db + d.gain_db + d.event_gain_db;
    const measured = median(xs);
    rows.push({ key: k, bed: k.split('|')[0], layer: k.split('|')[1], id: k.split('|')[2],
                level_db: d.level_db, gain_db: d.gain_db, event_gain_db: r2(d.event_gain_db),
                predicted_rel_db: r2(predicted), measured_rel_db: r2(measured),
                error_db: r2(measured - predicted), n: xs.length });
  }
  const errs = rows.map((r) => Math.abs(r.error_db));
  const bad = rows.filter((r) => Math.abs(r.error_db) > CHAIN_TOL_DB);
  out.checks.B2_declared_chain_predicts_render = {
    pass: bad.length === 0,
    n_event_ids: rows.length,
    n_unmatched_in_data: [...byId.keys()].filter((k) => !decl.has(k)).length,
    tolerance_db: CHAIN_TOL_DB,
    median_abs_error_db: rows.length ? r2(median(errs)) : null,
    p90_abs_error_db: rows.length ? r2(quantile(errs, 0.9)) : null,
    max_abs_error_db: rows.length ? r2(Math.max(...errs)) : null,
    n_outside_tolerance: bad.length,
    worst: bad.sort((a, b) => Math.abs(b.error_db) - Math.abs(a.error_db)).slice(0, 10),
    what: 'level_db + synth.gain_db + event_gain_db, read from game/data/audio/ambience/**, '
      + `predicts the RENDERED level relative to the bed within ±${CHAIN_TOL_DB} dB. This is the `
      + 'gain staging measured end to end: what a designer types against what came out.',
  };
}

// ---- B3: AMENDMENT-W1-22-01 §A's arithmetic, redone from measurement ------------------------
{
  const pars = events.map((e) => (e.peak_dbfs - e.bed_rms) - e.rel_db).filter((x) => Number.isFinite(x));
  const crests = beds.map((b) => b.crest).filter(Number.isFinite);
  const bedCrests = beds.map((b) => b.bed_crest).filter(Number.isFinite);
  const reach = beds.filter((b) => b.crest >= JUDGE_CREST_DB);
  // Beds that get within 1 dB of the judge's bar with every event inside §A's band.
  const nearMiss = [];
  for (const b of beds) {
    if (b.crest >= JUDGE_CREST_DB || b.crest < JUDGE_CREST_DB - 1.5) continue;
    const evs = events.filter((e) => e.bed === b.bed && e.tod === b.tod);
    if (!evs.length) continue;
    const anyOut = evs.some((e) => {
      const [lo, hi] = BANDS[e.layer];
      return e.rel_db < lo - TOL_DB || e.rel_db > hi + TOL_DB;
    });
    if (!anyOut) nearMiss.push({ bed: b.bed, tod: b.tod, crest_db: r2(b.crest),
                                 short_by_db: r2(JUDGE_CREST_DB - b.crest),
                                 loudest_event_rel_db: r2(Math.max(...evs.map((e) => e.rel_db))) });
  }
  const parMed = median(pars), parP90 = quantile(pars, 0.9);
  out.checks.B3_amendment_A_arithmetic = {
    // Not a gate: this is a reading on a proposed amendment, reported and never gated.
    gated: false,
    amendment_assumes_grain_par_db: [6, 10],
    measured_grain_par_db: { n: pars.length, min: r2(Math.min(...pars)), p10: r2(quantile(pars, 0.1)),
                             median: r2(parMed), p90: r2(parP90), max: r2(Math.max(...pars)),
                             frac_inside_6_10: r2(pars.filter((x) => x >= 6 && x <= 10).length / pars.length),
                             frac_above_10: r2(pars.filter((x) => x > 10).length / pars.length) },
    required_event_level_to_reach_judge_bar_db: {
      amendment_says: 10,
      at_median_grain: r2(JUDGE_CREST_DB - parMed),
      at_p90_grain: r2(JUDGE_CREST_DB - parP90),
      note: 'required rel_db = 20 dB - (the grain\'s own peak-to-window-RMS). The amendment fixes '
        + 'that second term at 6-10 dB by assumption; it is measurable from the same report and is '
        + 'measured here.',
    },
    band_ceiling_db: { L3: BANDS.L3[1] + TOL_DB, L4: BANDS.L4[1] + TOL_DB },
    crest: { median_bed_alone_db: r2(median(bedCrests)), median_full_mix_db: r2(median(crests)),
             n_reaching_judge_bar: reach.length, of_n: beds.length,
             max_db: r2(Math.max(...crests)),
             reaching: reach.map((b) => ({ bed: b.bed, tod: b.tod, crest_db: r2(b.crest) })) },
    near_miss_inside_the_band: nearMiss.sort((a, b) => a.short_by_db - b.short_by_db),
    what: 'AMENDMENT-W1-22-01 §A argues the judge\'s 20 dB crest bar and §A\'s level band cannot '
      + 'both be satisfied. The argument turns on the grain\'s own peak-to-RMS, which §A assumes '
      + 'is 6-10 dB. Here it is measured. `near_miss_inside_the_band` lists beds that come within '
      + '1.5 dB of the bar with EVERY event inside §A\'s band — each one is a counterexample to '
      + '"cannot both be satisfied".',
  };
}

// ---- report ---------------------------------------------------------------------------------
const gated = ['B1_every_event_in_band', 'B2_declared_chain_predicts_render'];
out.pass = gated.every((k) => out.checks[k].pass);

const outPath = args.out ? String(args.out)
  : join(ROOT, 'reports', 'w1-22-critic', 'r2', `bands${SAB ? '-sab-' + SAB : ''}.json`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');

const B1 = out.checks.B1_every_event_in_band;
const B2 = out.checks.B2_declared_chain_predicts_render;
const B3 = out.checks.B3_amendment_A_arithmetic;
console.log(`critic-w1-22-r2-bands — ${events.length} events over ${beds.length} bed×tod rows`);
console.log(`  report ${out.reads_report} @ ${out.report_commit} (${out.report_seconds}s)${SAB ? `  SABOTAGE=${SAB}` : ''}`);
console.log(`  B1 every event in §A's band          ${B1.pass ? 'PASS' : 'FAIL'}  `
  + `${B1.n_out_of_band}/${B1.of_n_events} outside (${B1.buried} buried, ${B1.shouting} shouting); `
  + `${B1.o3_median_blind_pairs} bed/layer pairs pass O3's median while holding one`);
console.log(`     between-event spread within a layer: median ${B1.between_event_spread_db.median} dB `
  + `over ${B1.between_event_spread_db.n_multi_event_layers} layers`);
for (const w of B1.worst.slice(0, 5)) {
  console.log(`     ${w.how.padEnd(8)} ${w.bed}/${w.layer}/${w.id} at ${w.rel_db} dB — ${w.by_db} dB outside`);
}
console.log(`  B2 declared chain predicts render    ${B2.pass ? 'PASS' : 'FAIL'}  `
  + `median |err| ${B2.median_abs_error_db} dB, p90 ${B2.p90_abs_error_db}, max ${B2.max_abs_error_db}; `
  + `${B2.n_outside_tolerance}/${B2.n_event_ids} outside ±${B2.tolerance_db}`);
console.log(`  B3 AMENDMENT §A arithmetic (reported, not gated)`);
console.log(`     grain peak-to-RMS: amendment assumes 6-10 dB; measured median `
  + `${B3.measured_grain_par_db.median}, p90 ${B3.measured_grain_par_db.p90} `
  + `(${r2(B3.measured_grain_par_db.frac_above_10 * 100)}% above 10)`);
console.log(`     event level needed for 20 dB crest: amendment says +10; measured `
  + `${B3.required_event_level_to_reach_judge_bar_db.at_median_grain} at the median grain, `
  + `${B3.required_event_level_to_reach_judge_bar_db.at_p90_grain} at the p90 grain `
  + `(band ceiling +${B3.band_ceiling_db.L3}/+${B3.band_ceiling_db.L4})`);
console.log(`     ${B3.crest.n_reaching_judge_bar}/${B3.crest.of_n} clips reach 20 dB; `
  + `${B3.near_miss_inside_the_band.length} come within 1.5 dB with EVERY event inside the band`);
for (const n of B3.near_miss_inside_the_band.slice(0, 4)) {
  console.log(`     near-miss ${n.bed}/${n.tod} at ${n.crest_db} dB — short by ${n.short_by_db}, `
    + `loudest event ${n.loudest_event_rel_db} dB rel bed`);
}
console.log(`  -> ${outPath.replace(ROOT + '/', '')}`);
process.exit(out.pass ? 0 : 1);
