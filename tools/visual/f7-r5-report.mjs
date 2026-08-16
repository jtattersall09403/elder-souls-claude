#!/usr/bin/env node
/**
 * f7-r5-report.mjs — read f7-r5-sweep.mjs output and print every arm beside the DRIFT BAND that
 * the same unchanged arm produced over the same ordinals. No new measurement; pure arithmetic over
 * `sweep.json`, so a critic can check the tables in a verdict against the file they came from.
 *
 * THE RULE IT ENFORCES IN PRINT: no number without its band. Every arm row is followed by what an
 * arm that changed NOTHING scored on the same quantity, and any arm result inside that band is
 * marked `~drift` rather than reported as an effect.
 *
 *   node tools/visual/f7-r5-report.mjs <sweep.json> [<sweep.json> ...]
 */
import fs from 'node:fs';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!files.length) { console.error('usage: f7-r5-report.mjs <sweep.json> ...'); process.exit(2); }

const fmt = (v, w = 7) => String(v === null || v === undefined ? '-' : v).padStart(w);
const band = (s) => (s && typeof s.range === 'number' ? s.range : null);

for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log(`\n${'='.repeat(100)}`);
  console.log(`${f}`);
  console.log(`site=${j.site} region=${j.region_from_census} k=${j.region_k} mode=${j.mode} interleaved=${j.interleaved} order=${j.arm_order}`);
  console.log(`band default in source at run time: uWaterShoreBandM = ${j.head_expression_asserted && j.head_expression_asserted.shore_band_uniform_default}`);
  if (j.stand_verification) console.log(`stand: offset=${j.stand_verification.teleport_offset_m} m, running field region = ${j.stand_verification.running_field_region_at_player}`);
  if (j.pageErrors && j.pageErrors.length) console.log(`PAGE ERRORS: ${JSON.stringify(j.pageErrors)}`);

  for (const [poseId, pose] of Object.entries(j.poses || {})) {
    if (pose.void) { console.log(`\n  ${poseId}: VOID — ${pose.why}`); continue; }
    console.log(`\n  POSE ${poseId}  water_edge_on_screen=${pose.water_edge_verified && pose.water_edge_verified.on_screen}  baseline captures=${(pose.baseline_captures || []).length}`);
    const ths = Object.keys(pose.baseline_drift || {});
    for (const thr of ths) {
      const d = pose.baseline_drift[thr];
      console.log(`\n   ── threshold ${thr} ──  pinned mask ${pose.pinned_mask_px[thr]} px,  L_hidden ${pose.hidden_frame_luma[thr]}`);
      console.log(`      DRIFT BAND from ${d.captures} captures of the UNCHANGED baseline arm:`);
      console.log(`        mean_luma range ${band(d.mean_luma)}   width(closed) range ${band(d.gradient_width_px_closed)}   own_mask range ${d.own_mask_pct_range}%`);
      console.log(`        an arm that changed NOTHING would score presence ${d.presence_pct_if_scored_as_an_arm ? d.presence_pct_if_scored_as_an_arm.min + '–' + d.presence_pct_if_scored_as_an_arm.max + '%' : '-'}`);
      console.log(`        FresnelDelta range ${band(d.FresnelDelta)}   ShoreDelta range ${band(d.ShoreDelta)}`);
      console.log(`      ${'arm'.padEnd(16)} ${fmt('pres%')} ${fmt('width')} ${fmt('wRaw')} ${fmt('luma')} ${fmt('maskΔ%')} ${fmt('FresnD',8)} ${fmt('ShoreD',8)} ${fmt('NormE',8)}`);
      const lumaBand = band(d.mean_luma), widthBand = band(d.gradient_width_px_closed);
      const presBand = d.presence_pct_if_scored_as_an_arm;
      for (const [armId, a] of Object.entries(pose.arms || {})) {
        const b = a.by_threshold && a.by_threshold[thr];
        if (!b) continue;
        const w = b.shore && b.shore.gradient_width_px, wr = b.shore_raw && b.shore_raw.gradient_width_px;
        const flags = [];
        if (a.VACUOUS) flags.push('VACUOUS');
        if (presBand && typeof b.presence_pct === 'number' && b.presence_pct >= presBand.min && b.presence_pct <= presBand.max) flags.push('~drift');
        if (widthBand !== null && typeof w === 'number') {
          const bw = (pose.baseline_captures || []).map((c) => c.by_threshold[thr].shore && c.by_threshold[thr].shore.gradient_width_px).filter((v) => typeof v === 'number');
          if (bw.length && w >= Math.min(...bw) && w <= Math.max(...bw)) flags.push('width~drift');
        }
        console.log(`      ${armId.padEnd(16)} ${fmt(b.presence_pct)} ${fmt(w)} ${fmt(wr)} ${fmt(b.mean_luma)} ${fmt(b.own_mask_delta_pct)} ${fmt(b.m12.FresnelDelta, 8)} ${fmt(b.m12.ShoreDelta, 8)} ${fmt(b.m12.NormalEnergy, 8)}  ${flags.join(' ')}`);
      }
    }
  }
  for (const [poseId, m] of Object.entries(j.motion || {})) {
    console.log(`\n  MOTION ${poseId}`);
    for (const [armId, a] of Object.entries(m.arms || {})) {
      console.log(`    ${armId}: TemporalVar=${a.temporal.TemporalVar} (band >= 0.002, hard fail < 0.0005) -> ${a.temporal.verdict}`);
      console.log(`      over ${a.temporal.frames} stationary frames, mask ${a.temporal.mask_px} px; orbit ${(a.orbit.frames || []).filter((x) => x.frame).length}/${a.orbit.bearings} bearings at radius ${a.orbit.radius_m} m`);
      const s = a.temporal.mean_Yp_series;
      if (s && s.length) console.log(`      mean_Yp range ${Math.min(...s).toFixed(6)} .. ${Math.max(...s).toFixed(6)}`);
    }
  }
  for (const [poseId, rows] of Object.entries(j.supersample || {})) {
    console.log(`\n  SUPERSAMPLE ${poseId}  (RI-VIS04 §8 / RI-VIS11 §3)`);
    for (const [armId, r] of Object.entries(rows)) {
      console.log(`    ${armId}: 1x adj=${r.native_1x && r.native_1x.mean_abs_dY_adjacent} ratio=${r.native_1x && r.native_1x.stipple_ratio}  ->  2x-downsampled adj=${r.supersampled_2x_downsampled && r.supersampled_2x_downsampled.mean_abs_dY_adjacent} ratio=${r.supersampled_2x_downsampled && r.supersampled_2x_downsampled.stipple_ratio}`);
      console.log(`      hf_survival = ${r.hf_energy_surviving_pct}%   (RI-VIS11 §3 band >= 70%, fail < 45% -> the detail is aliasing)`);
    }
  }
}
console.log('');
