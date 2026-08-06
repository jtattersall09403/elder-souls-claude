// battery.mjs — assembles RI-VIS03's twelve metrics into the normative verdict object:
// bands, pass/fail, named hard-fail diagnoses, AT DEFAULT comparison, and the §Scoring rules.
//
// Design rule, from the brief: never emit a number the tool did not compute. Every statistic
// is {value, unit, profile, measurable, reason, band, pass}; a metric with no measurable
// statistics is `measurable: false` with a reason, is EXCLUDED from the score denominator,
// and is listed in verdict.unmeasurable so that "skipped == passed" is impossible to read.

import * as V from './vis03.mjs';

const { S, U } = V;

/** attach the profile name to every statistic (the contract asks for it on each one) */
function stamp(stats, profile) {
  for (const k of Object.keys(stats)) stats[k].profile = profile;
  return stats;
}
const outside = (st) => st.measurable && st.band && st.pass === false;

function metric(id, name, profile, stats, opts = {}) {
  stamp(stats, profile);
  const measurableStats = Object.values(stats).filter((s) => s.measurable);
  const m = {
    id, name, profile,
    measurable: opts.skipped ? false : measurableStats.length > 0,
    skipped: opts.skipped || null,
    reason: opts.reason || (opts.skipped ? opts.skipped : (measurableStats.length ? null : 'no statistic in this metric could be computed')),
    stats,
    hard_fails: opts.hard_fails || [],
    soft_fails: Object.entries(stats).filter(([, s]) => outside(s)).map(([k]) => k),
    diagnoses: opts.diagnoses || [],
    detail: opts.detail || null,
  };
  // a statistic that triggered a named hard fail is not also counted as a soft fail
  const hardStats = new Set(m.hard_fails.map((h) => h.stat));
  m.soft_fails = m.soft_fails.filter((k) => !hardStats.has(k));
  m.hard = m.hard_fails.length > 0;
  m.soft = !m.hard && m.soft_fails.length > 0;
  return m;
}
const HF = (stat, value, rule, diagnosis, remedy = null) => ({ stat, value: value === null ? null : +value.toFixed(6), rule, diagnosis, remedy });

/**
 * Run the whole battery on one prepared image.
 * @param {object} pl        planes from V.prepare()
 * @param {object} o         { profile, shot, anti (M8 anti-reference values), sequence, water,
 *                             stationaryPair, displacements }
 */
export function runBattery(pl, o = {}) {
  const profile = o.profile || 'exterior_daylight';
  const P = V.PROFILES[profile];
  if (!P) throw new Error(`unknown profile "${profile}" (known: ${V.PROFILE_NAMES.join(', ')})`);
  const bands = { ...P };
  const ov = o.shot && V.SHOT_OVERRIDES[o.shot];
  if (ov) for (const k of Object.keys(ov)) bands[k] = { ...(bands[k] || {}), ...ov[k] };
  const skip = new Set(P.skip);

  const G = V.sobel(pl.Yp, pl.W, pl.H);
  const masks = V.computeMasks(pl, G);
  const M = {};

  // ---- M1 -----------------------------------------------------------------------------
  const r1 = V.M1(pl);
  {
    const b = bands.M1;
    const st = {
      DR: S(r1.DR, 'Yp', b.DR),
      occupancy: S(r1.occupancy, 'fraction of 256 bins', b.occupancy),
      blown: S(r1.blown, 'fraction of pixels', b.blown),
      crushed: S(r1.crushed, 'fraction of pixels', b.crushed),
      mean_Yp: S(r1.mean_Yp, 'Yp', b.mean_Yp),
      skew: S(r1.skew, 'dimensionless', null),
      P1: S(r1.P1, 'Yp', null), P50: S(r1.P50, 'Yp', null), P99: S(r1.P99, 'Yp', null),
      // added on ACQUISITION-REPORT §10 evidence: modern 9.20-11.75 vs 2002 5.61-8.31, no overlap
      stops: S(r1.stops, 'stops (log2 of linear-luminance p99.5/p0.5)', { min: 9.0 }),
    };
    const hf = [], dg = [];
    if (r1.DR < 0.55) hf.push(HF('DR', r1.DR, 'DR < 0.55', 'WASHED / NO TONEMAPPING / NO LIGHTING RANGE', 'RI-VIS04 §5 — add a tonemapping curve and exposure'));
    if (r1.blown > 2 * b.blown.max) hf.push(HF('blown', r1.blown, `blown > 2x profile max (${2 * b.blown.max})`, 'HARD CLIPPING — see M9', 'RI-VIS04 §5 — add a filmic shoulder'));
    if (r1.mean_Yp < 0.18 && r1.P99 >= 0.95 && r1.skew > 1.6) {
      hf.push(HF('mean_Yp', r1.mean_Yp, 'mean Yp < 0.18 AND P99 >= 0.95 AND skew > 1.6', 'SUSPECTED MISSING sRGB OUTPUT ENCODING (a linear buffer shown without the transfer function)', 'renderer.outputColorSpace = SRGBColorSpace'));
      dg.push('SUSPECTED LINEAR OUTPUT (no sRGB encode)');
    }
    M.M1 = metric('M1', 'Luminance histogram spread and dynamic range', profile, st, { hard_fails: hf, diagnoses: dg, detail: { hist256: r1.hist256 } });
  }

  // ---- M2 -----------------------------------------------------------------------------
  const r2 = V.M2(pl, masks);
  {
    const b = bands.M2;
    const st = {
      C_global: S(r2.C_global, 'stdev of Yp over FG_MASK', b.C_global),
      C_local_med: r2.C_local_med === null ? U('stdev of Yp per 32x32 tile', 'no 32x32 tile lies entirely inside FG_MASK', b.C_local_med) : S(r2.C_local_med, 'stdev of Yp per 32x32 tile', b.C_local_med),
      C_local_p90: r2.C_local_p90 === null ? U('stdev of Yp per 32x32 tile', 'no full FG tile') : S(r2.C_local_p90, 'stdev of Yp per 32x32 tile', null),
      C_local_p10: r2.C_local_p10 === null ? U('stdev of Yp per 32x32 tile', 'no full FG tile', b.C_local_p10) : S(r2.C_local_p10, 'stdev of Yp per 32x32 tile', b.C_local_p10),
      tiles: S(r2.tiles, 'count of 32x32 tiles fully inside FG_MASK', null),
    };
    const hf = [];
    if (r2.C_local_med !== null && r2.C_local_med < 0.025) hf.push(HF('C_local_med', r2.C_local_med, 'C_local_med < 0.025', 'FLAT SHADING — escalate to M8 for confirmation', 'RI-VIS04 — normal maps, shadowing, material variation'));
    if (r2.C_local_p10 !== null && r2.C_local_p10 < 0.004) hf.push(HF('C_local_p10', r2.C_local_p10, 'C_local_p10 < 0.004', `>=10% of the frame is a perfectly uniform surface; flattest tile centroid ${r2.flattest_tile ? r2.flattest_tile.centroid.join(',') : '?'}`, 'find the untextured wall/ground/water plane at that centroid'));
    if (r2.C_global !== null && r2.C_global > 0.34) hf.push(HF('C_global', r2.C_global, 'C_global > 0.34', 'LIKELY BLOWN/CLIPPED rather than detailed — cross-check M9', null));
    M.M2 = metric('M2', 'Global and local RMS contrast', profile, st, { hard_fails: hf, detail: { flattest_tile: r2.flattest_tile } });
  }

  // ---- M3 (CIELAB) --------------------------------------------------------------------
  const r3 = V.M3(pl, masks);
  {
    const b = bands.M3;
    if (!r3) {
      M.M3 = metric('M3', 'Colour distribution and saturation statistics (CIELAB)', profile,
        { meanC: U('CIELAB C*', 'FG_MASK is empty', b.meanC) }, { reason: 'FG_MASK is empty' });
    } else {
      const st = {
        meanC: S(r3.meanC, 'CIELAB C*', b.meanC),
        p95C: S(r3.p95C, 'CIELAB C*', b.p95C),
        H_hue: S(r3.H_hue, 'bits (0..5.17)', b.H_hue),
        chroma_frac: S(r3.chroma_frac, 'fraction of FG_MASK with C* > 8', b.chroma_frac),
      };
      const hf = [];
      if (r3.meanC > 45) hf.push(HF('meanC', r3.meanC, 'meanC > 45', 'GARISH UNTEXTURED PLACEHOLDER COLOURS (raw material colours, no albedo texture, no lighting desaturation)', 'RI-VIS04 — albedo textures'));
      if (r3.p95C < 20) hf.push(HF('p95C', r3.p95C, 'p95C < 20', 'DEAD RENDER — nothing in the frame is coloured', null));
      if (r3.H_hue < 1.2) hf.push(HF('H_hue', r3.H_hue, 'H_hue < 1.2', 'ONE HUE FAMILY — one material, or a full-screen colour overlay swamping everything', null));
      M.M3 = metric('M3', 'Colour distribution and saturation statistics (CIELAB)', profile, st, {
        hard_fails: hf, detail: { hue_hist36: r3.hue_hist36 },
        diagnoses: r3.meanC < b.meanC.min ? [] : [],
      });
      // RI-VIS03 M3 §note: a LOW meanC inside band is the correct art-direction outcome and is
      // not a fidelity failure. Only a value below the band floor fires.
      M.M3.note = 'RI-VIS03 M3 §note: a low meanC *inside* the band is correct for a muted art direction and is not a fidelity failure.';
    }
  }

  // ---- M4 -----------------------------------------------------------------------------
  const r4 = V.M4(pl, masks, G, 0.08);
  {
    const b = bands.M4;
    const st = {
      ED_1: S(r4.ED_1, 'fraction of FG_MASK with |grad| > 0.08', b.ED_1),
      ED_2: S(r4.ED_2, 'fraction, 2x box-downsampled', null),
      ED_4: S(r4.ED_4, 'fraction, 4x box-downsampled', null),
      scale_ratio: S(r4.scale_ratio, 'ED_4 / ED_1', b.scale_ratio),
      mean_gradient: S(r4.mean_gradient, 'normalised Sobel magnitude', null),
    };
    const hf = [];
    if (r4.ED_1 !== null && r4.ED_1 < 0.045) hf.push(HF('ED_1', r4.ED_1, 'ED_1 < 0.045', 'UNTEXTURED COLOURED BOXES (the flagship "we have no art" detector)', 'RI-VIS04 — textures and detail meshes'));
    if (r4.scale_ratio !== null && r4.scale_ratio < 0.22) hf.push(HF('scale_ratio', r4.scale_ratio, 'scale_ratio < 0.22', 'NOISE OR ALIASING, NOT STRUCTURE — all detail lives at one pixel scale and vanishes on downsample. Cross-check M5 NYQ.', 'this also fires on film-grain added to game M5/M2 — see RI-VIS03 "How we lose"'));
    if (r4.ED_1 !== null && r4.ED_1 > 0.42) hf.push(HF('ED_1', r4.ED_1, 'ED_1 > 0.42', 'HASH/ALIAS STORM (untamed alpha-test foliage, no AA, no mips)', 'RI-VIS04 — mipmaps + AA'));
    M.M4 = metric('M4', 'Edge density (geometric + texture detail proxy)', profile, st, { hard_fails: hf });
  }

  // ---- M5 (native 1024^2 crop) ---------------------------------------------------------
  const r5 = V.M5(pl, masks, 1024);
  {
    const b = bands.M5;
    if (r5.unmeasurable) {
      M.M5 = metric('M5', 'High-frequency energy and spectral slope (FFT band ratio)', profile, {
        HFR: U('E_HIGH / (E_LOW+E_MID+E_HIGH)', r5.unmeasurable, b.HFR),
        NYQ_ratio: U('E_NYQ / E_HIGH', r5.unmeasurable, b.NYQ_ratio),
        alpha: U('spectral slope exponent', r5.unmeasurable, b.alpha),
      }, { reason: r5.unmeasurable });
    } else {
      const st = {
        HFR: S(r5.HFR, 'E_HIGH / (E_LOW+E_MID+E_HIGH)', b.HFR),
        NYQ_ratio: S(r5.NYQ_ratio, 'E_NYQ / E_HIGH', b.NYQ_ratio),
        alpha: S(r5.alpha, 'spectral slope exponent (1/f^alpha)', b.alpha),
        E_LOW: S(r5.E_LOW, 'power', null), E_MID: S(r5.E_MID, 'power', null),
        E_HIGH: S(r5.E_HIGH, 'power', null), E_NYQ: S(r5.E_NYQ, 'power', null),
      };
      const hf = [];
      if (r5.HFR < 0.03) hf.push(HF('HFR', r5.HFR, 'HFR < 0.03', 'NO TEXTURE DETAIL (flat colours, a 64px texture stretched over a wall, or over-blurred post)', 'RI-VIS04 — texture resolution'));
      if (r5.NYQ_ratio > 0.30) hf.push(HF('NYQ_ratio', r5.NYQ_ratio, 'NYQ_ratio > 0.30', 'NO ANTI-ALIASING and/or NO MIPMAPS', 'RI-VIS03 M5: recompute on a 2x supersampled capture — if it collapses it is AA/mip config; if it persists it is geometry aliasing needing TAA/SMAA'));
      if (r5.alpha !== null && r5.alpha > 3.2) hf.push(HF('alpha', r5.alpha, 'alpha > 3.2', 'OVER-SMOOTHED — the "plastic world" render', 'RI-VIS04 — reduce post blur, add surface detail'));
      if (r5.alpha !== null && r5.alpha < 1.1) hf.push(HF('alpha', r5.alpha, 'alpha < 1.1', 'ALIAS STORM — energy is white-noise-flat across frequencies', null));
      M.M5 = metric('M5', 'High-frequency energy and spectral slope (FFT band ratio)', profile, st, {
        hard_fails: hf,
        detail: { crop: `native ${r5.K}x${r5.K} at (${r5.crop_origin[0]},${r5.crop_origin[1]})`, crop_shifted: r5.crop_shifted, crop_sky_frac: r5.crop_sky_frac, resampled: false },
      });
    }
  }

  // ---- M6 -----------------------------------------------------------------------------
  const r6m = V.M6(pl, masks, r2.C_local_med);
  {
    const b = bands.M6;
    const st = {
      retention: r6m.retention === null ? U('C_shadow_med / C_local_med', r6m.hard || 'no shadow tile and/or no M2 local contrast', b.retention) : S(r6m.retention, 'C_shadow_med / C_local_med', b.retention),
      hue_offset: r6m.hue_offset === null ? U('degrees', 'no chromatic pixels in SHADOW_MASK or LIT_MASK', b.hue_offset) : S(r6m.hue_offset, 'degrees', b.hue_offset),
      shadow_frac: S(r6m.shadow_frac, 'fraction of frame', b.shadow_frac),
      C_shadow: r6m.C_shadow === null ? U('CIELAB C*', 'SHADOW_MASK empty', b.C_shadow) : S(r6m.C_shadow, 'CIELAB C*', b.C_shadow),
      C_shadow_med: r6m.C_shadow_med === undefined || r6m.C_shadow_med === null ? U('stdev of Yp per shadow tile', 'no 32x32 tile is >=50% SHADOW_MASK') : S(r6m.C_shadow_med, 'stdev of Yp per shadow tile', null),
    };
    const hf = [];
    if (r6m.hard) hf.push(HF('shadow_frac', r6m.shadow_frac, '|SHADOW_MASK|/N < 0.03', profile === 'exterior_daylight' ? 'NO SHADOW CASTING AT ALL (castShadow/receiveShadow never set, or renderer.shadowMap.enabled = false)' : 'NO SHADOWED REGION IN FRAME', 'RI-VIS04 — enable shadow mapping'));
    if (r6m.retention !== null && r6m.retention < 0.30) hf.push(HF('retention', r6m.retention, 'retention < 0.30', 'CRUSHED BLACKS / NO AMBIENT / NO IBL — the shadowed quarter is a silhouette, not an environment-lit surface', 'RI-VIS04 — add IBL/env map and AO'));
    if (r6m.hue_offset !== null && r6m.hue_offset < 6) hf.push(HF('hue_offset', r6m.hue_offset, 'hue_offset < 6 deg', 'ONE LIGHT SOURCE ONLY (a single white DirectionalLight + white AmbientLight)', 'RI-VIS04 — warm key + cool sky fill'));
    M.M6 = metric('M6', 'Shadow-region detail retention', profile, st, { hard_fails: hf });
    // M6b needs a character silhouette/ground contact, i.e. an object-id pass. Not fakeable.
    M.M6.M6b = U('ratio of mean Yp in the contact band to ground 100 px away',
      'M6b needs the character silhouette-to-ground contact band, which requires an object-id/debug render pass the harness does not supply for a bare image. Not computable from pixels alone and no proxy is honest.');
    M.M6.M6b.profile = profile;
  }

  // ---- M7 -----------------------------------------------------------------------------
  {
    const b = bands.M7;
    if (skip.has('M7')) {
      M.M7 = metric('M7', 'Sky and horizon gradient smoothness', profile, {}, { skipped: `profile ${profile} skips M7 (RI-VIS03 §0c). A skipped metric never counts as a pass.` });
    } else {
      const r7 = V.M7(pl, masks);
      if (r7.skipped) {
        M.M7 = metric('M7', 'Sky and horizon gradient smoothness', profile, {
          sky_frac: S(r7.sky_frac, 'fraction of frame', { min: 0.02 }),
        }, { skipped: `${r7.skipped} [detector: ${masks.sky_detect}]` });
      } else {
        const st = {
          dY_sky: S(r7.dY_sky, 'Yp', b.dY_sky),
          dC_sky: S(r7.dC_sky, 'CIELAB C*', b.dC_sky),
          dH_sky: r7.dH_sky === null ? U('degrees', 'sky has no chromatic content to take a hue from', b.dH_sky) : S(r7.dH_sky, 'degrees', b.dH_sky),
          BI: S(r7.BI, 'outliers per 100 sky rows', b.BI),
          sky_noise: r7.sky_noise === null ? U('stdev of Yp per 16x16 sky tile', 'no 16x16 tile lies entirely inside SKY_MASK', b.sky_noise) : S(r7.sky_noise, 'stdev of Yp per 16x16 sky tile', b.sky_noise),
          sky_frac: S(r7.sky_frac, 'fraction of frame', { min: 0.02 }),
          sky_span_frac: S(r7.sky_span_frac, 'fraction of frame height spanned by SKY_MASK', { min: 0.15 }),
          dY_per_span: S(r7.dY_per_span, 'Yp per unit of frame height spanned', null),
        };
        const hf = [], soft = [];
        if (r7.dY_sky < 0.02 && r7.dC_sky < 2) hf.push(HF('dY_sky', r7.dY_sky, 'dY_sky < 0.02 AND dC_sky < 2', 'FLAT SINGLE-COLOUR SKY (scene.background = new THREE.Color(...)) — the most common Three.js tell', 'RI-VIS04 — a sky/scattering model'));
        if (r7.BI > 4) hf.push(HF('BI', r7.BI, 'BI > 4 per 100 rows', 'BANDING — no dithering on an 8-bit gradient', 'one-line noise dither in the tonemap pass'));
        if (r7.sky_noise !== null && r7.sky_noise < 0.0004) soft.push('sky_noise < 0.0004 → mathematically perfect sky = a linear gradient texture, not a scattering model (RI-VIS03: SOFT fail, -1, not hard)');
        M.M7 = metric('M7', 'Sky and horizon gradient smoothness', profile, st, { hard_fails: hf, diagnoses: soft, detail: { y_top: r7.y_top, y_horizon: r7.y_horizon, sky_tiles: r7.sky_tiles, sky_detect: masks.sky_detect } });
        if (soft.length && !M.M7.soft_fails.includes('sky_noise')) { M.M7.soft_fails.push('sky_noise'); M.M7.soft = !M.M7.hard; }
      }
    }
  }

  // ---- M8 (headline) -------------------------------------------------------------------
  const r8 = V.M8(pl, masks);
  {
    const b = bands.M8;
    if (r8.unmeasurable) {
      M.M8 = metric('M8', 'The flat-shading detector', profile, {
        FS_score: U('area-weighted within-colour-bin stdev of Yp', r8.unmeasurable, b.FS_score),
        LargestFlat: U('fraction of FG_MASK', r8.unmeasurable, b.LargestFlat),
      }, { reason: r8.unmeasurable });
    } else {
      const st = {
        FS_score: S(r8.FS_score, 'area-weighted within-colour-bin stdev of Yp', b.FS_score),
        LargestFlat: S(r8.LargestFlat, 'fraction of FG_MASK', b.LargestFlat),
        TotalFlat: S(r8.TotalFlat, 'fraction of FG_MASK', b.TotalFlat),
        bins_used: S(r8.bins_used, 'count of 6x6x6 RGB bins with >= 0.5% of FG_MASK', null),
      };
      const hf = [], dg = [];
      if (r8.FS_score !== null && r8.FS_score < 0.018) hf.push(HF('FS_score', r8.FS_score, 'FS_score < 0.018', 'HARD FAIL — THE FRAME IS MADE OF FLAT COLOUR FIELDS', 'RI-VIS04 — textures, normal maps, real lighting. RI-VIS01 CC-3: a stylisation defence is inadmissible here.'));
      if (r8.LargestFlat > 0.15) hf.push(HF('LargestFlat', r8.LargestFlat, 'LargestFlat > 0.15 (excluding SKY_MASK)', `HARD FAIL — one object occupies ${(r8.LargestFlat * 100).toFixed(1)}% of the foreground with no shading variation. bbox ${r8.largest_component ? r8.largest_component.bbox.join(',') : '?'}, mean rgb ${r8.largest_component && r8.largest_component.mean_rgb ? r8.largest_component.mean_rgb.join(',') : '?'}`, 'identify the object at that bounding box'));
      // AT DEFAULT — RI-VIS03 M8 §Reporting requirement
      if (o.anti && typeof o.anti.FS_score === 'number' && r8.FS_score !== null) {
        const rel = Math.abs(r8.FS_score - o.anti.FS_score) / Math.max(o.anti.FS_score, 1e-6);
        st.FS_score_anti = S(o.anti.FS_score, 'area-weighted within-colour-bin stdev of Yp (anti-reference)', null);
        st.FS_score_at_default = S(rel, '|ours - anti| / anti', { min: 0.15 });
        if (rel < 0.15) hf.push(HF('FS_score', r8.FS_score, '|ours - anti| / anti < 0.15', `AT DEFAULT vs the anti-reference (${o.anti.FS_score}) — hard fail regardless of band; the shot is capped at 2`, null));
        dg.push(`M8 reported as the triple (anti ${o.anti.FS_score}, ours ${r8.FS_score === null ? 'n/a' : r8.FS_score.toFixed(4)}, band >= ${b.FS_score.min})`);
      } else {
        dg.push('AT DEFAULT not computed: no anti-reference supplied (--anti). RI-VIS03 §Comparison method: without it the verdict is capped at 6/10.');
      }
      M.M8 = metric('M8', 'The flat-shading detector (headline metric)', profile, st, { hard_fails: hf, diagnoses: dg, detail: { largest_component: r8.largest_component } });
      M.M8.at_default = st.FS_score_at_default ? st.FS_score_at_default.value < 0.15 : null;
    }
  }

  // ---- M9 -----------------------------------------------------------------------------
  const r9 = V.M9(pl, masks, r1);
  {
    const b = V.M9_BANDS;
    const st = {
      ClipFrac: S(r9.ClipFrac, 'fraction of pixels with r,g,b all >= 0.99', b.ClipFrac),
      ShoulderRatio: r9.ShoulderRatio === null ? U('|Yp in [0.90,0.996)| / |Yp in [0.75,0.90)|', r9.shoulderReason, b.ShoulderRatio) : S(r9.ShoulderRatio, '|Yp in [0.90,0.996)| / |Yp in [0.75,0.90)|', b.ShoulderRatio),
      highlight_frac: S(r9.highlight_frac, 'fraction of pixels with Yp >= 0.75', null),
      HighlightDesat: r9.HighlightDesat === null ? U('C_top / C_all', 'FG_MASK has no chroma to normalise against', b.HighlightDesat) : S(r9.HighlightDesat, 'C_top / C_all', b.HighlightDesat),
      BloomHalo: r9.BloomHalo === null ? U('Yp difference', r9.bloomReason, b.BloomHalo) : S(r9.BloomHalo, 'Yp difference (annulus mean - frame mean)', b.BloomHalo),
      VeilIndex: S(r9.VeilIndex, 'P1(Yp) over FG_MASK', b.VeilIndex),
    };
    const hf = [], dg = [];
    if (r9.ClipFrac > 0.02) hf.push(HF('ClipFrac', r9.ClipFrac, 'ClipFrac > 0.02', 'HARD CLIPPING, NO SHOULDER', 'RI-VIS04 §5 — renderer.toneMapping = ACESFilmicToneMapping'));
    if (r9.ShoulderRatio !== null && r9.ShoulderRatio < 0.12) hf.push(HF('ShoulderRatio', r9.ShoulderRatio, 'ShoulderRatio < 0.12', 'LINEAR CLAMP — the histogram falls off a cliff into white', 'RI-VIS04 §5'));
    if (r9.HighlightDesat !== null && r9.HighlightDesat > 1.05) hf.push(HF('HighlightDesat', r9.HighlightDesat, 'HighlightDesat > 1.05', 'NO TONEMAPPING (a filmic curve desaturates highlights; a linear clamp keeps them saturated then clips a channel)', 'RI-VIS04 §5 — set renderer.toneMapping = ACESFilmicToneMapping'));
    if (r9.BloomHalo !== null && r9.BloomHalo <= 0.002) hf.push(HF('BloomHalo', r9.BloomHalo, 'BloomHalo <= 0.002', 'NO BLOOM', 'RI-VIS04 — thresholded bloom pass'));
    if (r9.BloomHalo !== null && r9.BloomHalo > 0.12) hf.push(HF('BloomHalo', r9.BloomHalo, 'BloomHalo > 0.12', 'BLOOM IS EATING THE FRAME', null));
    if (r9.VeilIndex > 0.14 && r9.BloomHalo !== null && r9.BloomHalo >= b.BloomHalo.min && r9.BloomHalo <= b.BloomHalo.max) {
      hf.push(HF('VeilIndex', r9.VeilIndex, 'VeilIndex > 0.14 with a passing BloomHalo', 'UNTHRESHOLDED BLOOM VEILING THE BLACKS', 'threshold the bloom prefilter'));
    }
    // RI-VIS03 M9 combined diagnosis rules — report the named cause, not just the numbers
    if (r9.HighlightDesat !== null && r9.HighlightDesat > 1.05 && r9.ClipFrac > 0.02) dg.push('NO TONEMAPPING');
    if (r1.mean_Yp < 0.18 && r1.skew > 1.6 && r1.P99 >= 0.95) dg.push('SUSPECTED LINEAR OUTPUT (no sRGB encode)');
    if (r9.ShoulderRatio !== null && r9.ShoulderRatio < 0.12 && r1.blown > 0.05) dg.push('EXPOSURE TOO HIGH / no auto-exposure');
    M.M9 = metric('M9', 'Tonemapping and colour response', profile, st, { hard_fails: hf, diagnoses: dg });
  }

  // ---- M10 ----------------------------------------------------------------------------
  {
    const b = bands.M10;
    if (skip.has('M10') || !b) {
      M.M10 = metric('M10', 'Aerial perspective / atmospheric depth', profile, {}, { skipped: `profile ${profile} has no M10 band in RI-VIS03 (§0c / M10 table). A skipped metric never counts as a pass.` });
    } else {
      const r10 = V.M10(pl, masks);
      if (r10.unmeasurable) {
        M.M10 = metric('M10', 'Aerial perspective / atmospheric depth', profile, {
          R_aerial: U('C_far / C_near', r10.unmeasurable, b.R_aerial),
          dC_depth: U('CIELAB C* difference', r10.unmeasurable, b.dC_depth),
        }, { reason: r10.unmeasurable });
      } else {
        const st = {
          R_aerial: S(r10.R_aerial, 'C_far / C_near', b.R_aerial),
          dY_depth: S(r10.dY_depth, 'Yp difference (far - near)', null),
          dC_depth: S(r10.dC_depth, 'CIELAB C* difference (far - near)', b.dC_depth),
          C_far: S(r10.C_far, 'median 32x32 tile stdev', null),
          C_near: S(r10.C_near, 'median 32x32 tile stdev', null),
        };
        const hf = [];
        if (r10.R_aerial > 0.85) hf.push(HF('R_aerial', r10.R_aerial, 'R_aerial > 0.85', 'NO ATMOSPHERIC ATTENUATION — the 400 m silhouette is as crisp as the 4 m rock (infinite-clarity tell)', 'RI-VIS04 §6 — height/exponential fog'));
        if (r10.R_aerial < 0.10) hf.push(HF('R_aerial', r10.R_aerial, 'R_aerial < 0.10', 'FOG WALL — distance is not attenuated, it is deleted; almost always concealing a short draw distance', 'cross-check M11 and the far-plane value'));
        if (r10.dC_depth > 0) hf.push(HF('dC_depth', r10.dC_depth, 'dC_depth > 0', 'DISTANT THINGS MORE SATURATED THAN NEAR — fog applied as a colour multiply rather than a mix, or absent with unlit raw material colours in the distance', 'RI-VIS04 §6'));
        M.M10 = metric('M10', 'Aerial perspective / atmospheric depth', profile, st, {
          hard_fails: hf,
          detail: { horizon_y: r10.horizon_y, far_rows: r10.far_rows, near_rows: r10.near_rows, two_capture_upgrade: 'FogDelta (fog on vs fog off) is the preferred form and needs the harness to drive the engine; not computable from a single supplied image.' },
        });
      }
    }
  }

  // ---- M11 (temporal) -------------------------------------------------------------------
  {
    const b = V.M11_BANDS;
    if (skip.has('M11')) {
      M.M11 = metric('M11', 'LOD pop and draw-distance stability', profile, {}, { skipped: `profile ${profile} skips M11 (RI-VIS03 §0c).` });
    } else {
      const r11 = V.M11(o.sequence, { W: pl.W, H: pl.H, animatedMask: o.animatedMask, displacements: o.displacements });
      if (r11.unmeasurable) {
        M.M11 = metric('M11', 'LOD pop and draw-distance stability', profile, {
          pops: U('POP events per sequence', r11.unmeasurable, b.pops),
          worst_pop: U('largest changed component as a fraction of the frame', r11.unmeasurable, b.worst_pop),
        }, { reason: r11.unmeasurable });
      } else {
        const st = { pops: S(r11.pops, 'POP events', b.pops), worst_pop: S(r11.worst_pop, 'fraction of frame', b.worst_pop) };
        const hf = [];
        if (r11.pops > 6) hf.push(HF('pops', r11.pops, 'pops > 6 per 120 frames', 'NAIVE LOD WITH NO HYSTERESIS OR DITHERED TRANSITION', 'RI-VIS04 §11'));
        if (r11.worst_pop > 0.02) hf.push(HF('worst_pop', r11.worst_pop, 'worst_pop > 0.02', 'A SINGLE LOD SWAP CHANGES >2% OF THE FRAME IN ONE FRAME', 'RI-VIS04 §11'));
        M.M11 = metric('M11', 'LOD pop and draw-distance stability', profile, st, {
          hard_fails: hf,
          diagnoses: [r11.displacement_gating, r11.animated_mask].filter((x) => x && x !== 'applied'),
          detail: { frames: r11.frames, pairs: r11.pairs, events: r11.events, gated_by_displacement: r11.gated_by_displacement },
        });
      }
    }
  }

  // ---- M12 (water) ----------------------------------------------------------------------
  {
    const b = V.M12_BANDS;
    const r12 = V.M12(pl, o.water, { sequence: o.sequence });
    if (r12.unmeasurable) {
      M.M12 = metric('M12', 'Water plausibility', profile, Object.fromEntries(Object.keys(b).map((k) => [k, U('see RI-VIS03 M12', r12.unmeasurable, b[k])])), { reason: r12.unmeasurable });
    } else {
      const mk = (v, unit, band, reason) => (v === null || v === undefined ? U(unit, reason || 'not computable on this mask', band) : S(v, unit, band));
      const st = {
        FresnelDelta: mk(r12.FresnelDelta, 'Yp (grazing - downward)', b.FresnelDelta),
        NormalEnergy: mk(r12.NormalEnergy, 'HFR over the water window', b.NormalEnergy, r12.normalReason),
        ShoreDelta: mk(r12.ShoreDelta, 'Yp difference (6px band vs 30px inside)', b.ShoreDelta),
        ReflCorr: mk(r12.ReflCorr, 'Pearson r', b.ReflCorr, r12.reflReason),
        TemporalVar: mk(r12.TemporalVar, 'stdev of mean Yp over stationary frames', b.TemporalVar, r12.tvReason),
      };
      const failRules = { FresnelDelta: 0.02, NormalEnergy: 0.012, ShoreDelta: 0.01, ReflCorr: 0.15, TemporalVar: 0.0005 };
      const diag = { FresnelDelta: 'NO FRESNEL; UNIFORM PLANE', NormalEnergy: 'NO NORMAL/RIPPLE DETAIL', ShoreDelta: 'NO DEPTH-BASED COLOUR, NO SHORELINE', ReflCorr: 'NO REFLECTION OF ANY KIND', TemporalVar: 'WATER IS STATIC' };
      const hf = [];
      for (const k of Object.keys(failRules)) {
        if (st[k].measurable && st[k].value < failRules[k]) hf.push(HF(k, st[k].value, `${k} < ${failRules[k]}`, diag[k], 'RI-VIS04 — water shader'));
      }
      const dg = [];
      if (hf.length >= 2) dg.push('WATER IS A BLUE PLANE (RI-VIS03 M12: any two of these failing) — this shot is capped at 3');
      M.M12 = metric('M12', 'Water plausibility', profile, st, { hard_fails: hf, diagnoses: dg, detail: { water_frac: r12.water_frac, normal_window: r12.normal_window } });
      M.M12.blue_plane = hf.length >= 2;
    }
  }

  // ---- verdict -------------------------------------------------------------------------
  const verdict = grade(M, { anti: !!o.anti, shot: o.shot });
  return { masks, metrics: M, verdict, raw: { M1: r1, M2: r2, M3: r3, M4: r4, M5: r5, M6: r6m, M8: { ...r8, _flatMask: undefined }, M9: r9 } };
}

/** RI-VIS03 §Scoring, including the absolute caps that override the arithmetic. */
export function grade(M, o = {}) {
  const ids = Object.keys(M);
  const runnable = ids.filter((k) => M[k].measurable && !M[k].skipped);
  const skipped = ids.filter((k) => M[k].skipped);
  const unmeasurable = ids.filter((k) => !M[k].measurable && !M[k].skipped);
  const hard = runnable.filter((k) => M[k].hard);
  const soft = runnable.filter((k) => M[k].soft);
  let score = runnable.length ? 10 * (runnable.length - soft.length * 0.5 - hard.length) / runnable.length : 0;
  score = Math.max(0, score);
  const caps = [];
  const cap = (v, why) => { if (score > v) { score = v; } caps.push({ cap: v, reason: why }); };
  if (M.M8 && M.M8.hard) cap(0, 'M8 hard fail — flat shading is not a deduction, it is the absence of rendering. Shot scores 0 and the wave FIDELITY score is capped at 2.');
  if (M.M8 && M.M8.at_default === true) cap(2, 'M8 AT DEFAULT vs the anti-reference.');
  if (M.M6 && M.M6.hard_fails.some((h) => h.stat === 'hue_offset')) cap(4, 'M6 hue_offset < 6 deg — one-light rendering.');
  if (M.M12 && M.M12.blue_plane) cap(3, 'M12: two or more water statistics failing.');
  if (!o.anti) caps.push({ cap: 6, reason: 'no anti-reference supplied, so AT DEFAULT could not be computed — RI-VIS03 §Comparison method step 2 caps the verdict at 6/10.' });
  if (!o.anti && score > 6) score = 6;

  return {
    runnable, skipped, unmeasurable,
    hard_fails: hard, soft_fails: soft,
    diagnoses: ids.flatMap((k) => (M[k].hard_fails || []).map((h) => `${k}.${h.stat} = ${h.value} (${h.rule}) → ${h.diagnosis}`)),
    score: +score.toFixed(2),
    caps,
    scoring_note: 'runnable excludes profile-skipped AND unmeasurable metrics; RI-VIS03 §0c — a skipped metric never counts as a pass and the score renormalises over the metrics actually run.',
  };
}
