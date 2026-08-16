/**
 * F4 ROUND-3 ANALYSER.
 *
 * Reads a `f4r3-capture.mjs` manifest and reports, FOR EVERY ARM AND ON BOTH DOMAINS (S64):
 *
 *   * M6 `hue_offset`, and — the part S64's crop/frame pair does not give you — `hue_lit_deg` and
 *     `hue_shadow_deg` SEPARATELY, because `hue_offset` is an angle between two circular means and
 *     cannot say which side moved. A lever that raises it by making SUNLIGHT blue and a lever that
 *     raises it by making SHADOWS blue produce the same number and are not the same change.
 *   * `retention`, `C_shadow`, `C_local_med`, `mean_Yp_lit`, `mean_Yp_shadow` (S59's paired guard).
 *   * The run's OWN noise floor (S61): mean|Δ|rgb between the `base`/`control` arm and its
 *     re-capture taken last, plus the `hue_offset` spread between them, on both domains. Every
 *     movement is reported as a multiple of that floor.
 *   * S60 clause (a) `lit_ratio` and clause (b) `cast_shadow_area` as a curve over
 *     tau ∈ {1,2,4,8,16}, wherever the manifest carries `shadows_off` / `key_off` / `env_off` arms
 *     for the same configuration — measured INSIDE the configuration, never inherited.
 *
 * M6 is the F4 r2 CRITIC's independent implementation, imported rather than reimplemented: it was
 * written from `RI-VIS03`'s pseudocode without opening `f4c-analyse.mjs` and then reproduced that
 * tool's figures on our crops to 0.02 deg and on three vendored plates spanning 12-96 deg. Two
 * implementations that agree are worth more than a third that might not; where a number matters I
 * report `f4c-analyse.mjs`'s alongside.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { measure } from '../../W1-F4-r2-critic/tools/m6-independent.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../../..');
const argv = process.argv.slice(2);
const manifestPath = argv[0];
const outPath = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
const M = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const [FW, FH] = M.resolution;

const raw = (p) => execFileSync('ffmpeg', ['-loglevel', 'error', '-i', p, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
const cropBuf = (b, [x0, y0, cw, ch]) => {
  const out = Buffer.alloc(cw * ch * 3);
  for (let y = 0; y < ch; y++) b.copy(out, y * cw * 3, ((y0 + y) * FW + x0) * 3, ((y0 + y) * FW + x0 + cw) * 3);
  return out;
};
const meanAbsD = (a, b) => { let s = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]); return s / n; };
const luma = (b, i) => 0.2126 * b[i * 3] + 0.7152 * b[i * 3 + 1] + 0.0722 * b[i * 3 + 2];

/** S60 clause (a) + (b) as a curve over tau, on one domain. */
function clauses(base, soff, koff, eoff) {
  const n = Math.min(base.length, soff.length, koff.length, eoff.length) / 3;
  const out = {};
  for (const tau of [1, 2, 4, 8, 16]) {
    let litN = 0, litK = 0, litE = 0, area = 0;
    for (let i = 0; i < n; i++) {
      const dk = (Math.abs(base[i * 3] - koff[i * 3]) + Math.abs(base[i * 3 + 1] - koff[i * 3 + 1]) + Math.abs(base[i * 3 + 2] - koff[i * 3 + 2])) / 3;
      const de = (Math.abs(base[i * 3] - eoff[i * 3]) + Math.abs(base[i * 3 + 1] - eoff[i * 3 + 1]) + Math.abs(base[i * 3 + 2] - eoff[i * 3 + 2])) / 3;
      if (luma(soff, i) - luma(base, i) > tau) area++; else { litN++; litK += dk; litE += de; }
    }
    out[`tau${tau}`] = {
      lit_fraction: +(litN / n).toFixed(5),
      lit_key: +(litK / Math.max(1, litN)).toFixed(4),
      lit_env: +(litE / Math.max(1, litN)).toFixed(4),
      lit_ratio: +((litK / Math.max(1, litN)) / Math.max(1e-9, litE / Math.max(1, litN))).toFixed(4),
      cast_shadow_area: +(area / n).toFixed(5),
    };
  }
  return out;
}

// group rows by (pair||weather||hour) so a multi-window manifest analyses each window separately
const groups = new Map();
for (const r of M.rows) {
  if (!r.file) continue;
  const k = r.pair || r.weather || `t${r.hour}` || 'all';
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}

const report = {
  manifest: path.relative(REPO, path.resolve(manifestPath)),
  mode: M.mode, tag: M.tag, served: M.served, renderer: M.renderer && M.renderer.class,
  evidence_class: M.evidence_class, resolution: M.resolution,
  instrument: 'M6/M2/M7 = corpus/90-verdicts/wave1/artifacts/W1-F4-r2-critic/tools/m6-independent.mjs (the r2 critic\'s independent implementation), imported unmodified',
  groups: {},
};

for (const [key, rows] of groups) {
  const crop = rows[0].crop || [300, 150, 512, 512];
  const bufs = {};
  const m6 = {};
  for (const r of rows) {
    const p = path.resolve(REPO, r.file);
    if (!fs.existsSync(p)) continue;
    const full = raw(p);
    bufs[r.arm] = { full, crop: cropBuf(full, crop) };
    m6[r.arm] = {
      sealed_judged_crop: measure(p, crop),
      full_frame: measure(p, null),
      readback: r.readback ? {
        sunColour: r.readback.sunColour, sunIntensity: r.readback.sunIntensity,
        uSunColour: r.readback.uSunColour, uHorizon: r.readback.uHorizon,
        environmentIntensity: r.readback.environmentIntensity,
        hemiVisible: r.readback.hemiVisible, ambientVisible: r.readback.ambientVisible,
        recipeId: r.readback.recipeId, probeIsMine: r.readback.probeIsMine,
        shadowIntensity: r.readback.shadowIntensity, cfgError: r.readback.cfgError,
      } : null,
      liveness: r.liveness,
    };
  }
  // the run's own noise floor (S61): the control and its re-capture, taken last
  const names = Object.keys(bufs);
  const ctl = names.find((n) => /^(p0-control|k0-control|b0-base|base)$/.test(n)) || names[0];
  const rec = names.find((n) => /recheck/.test(n));
  const floor = (ctl && rec) ? {
    control_arm: ctl, recheck_arm: rec,
    mean_abs_drgb_sealed_crop: +meanAbsD(bufs[ctl].crop, bufs[rec].crop).toFixed(4),
    mean_abs_drgb_full_frame: +meanAbsD(bufs[ctl].full, bufs[rec].full).toFixed(4),
    hue_offset_spread_crop: +Math.abs(m6[ctl].sealed_judged_crop.hue_offset_deg - m6[rec].sealed_judged_crop.hue_offset_deg).toFixed(2),
    hue_offset_spread_frame: +Math.abs(m6[ctl].full_frame.hue_offset_deg - m6[rec].full_frame.hue_offset_deg).toFixed(2),
    note: 'S61: a movement inside this band is `unresolved` and fails closed.',
  } : { note: 'NO RE-CAPTURE IN THIS RUN — no noise floor, so no movement in it is resolvable (S61 fails closed).' };

  // ablation deltas against the control, both domains, as a multiple of the floor
  const deltas = {};
  for (const n of names) {
    if (n === ctl) continue;
    const dc = +meanAbsD(bufs[ctl].crop, bufs[n].crop).toFixed(4);
    const df = +meanAbsD(bufs[ctl].full, bufs[n].full).toFixed(4);
    deltas[n] = {
      sealed_crop_mean_abs_drgb: dc, full_frame_mean_abs_drgb: df,
      x_noise_floor_crop: floor.mean_abs_drgb_sealed_crop ? +(dc / floor.mean_abs_drgb_sealed_crop).toFixed(2) : null,
      x_noise_floor_frame: floor.mean_abs_drgb_full_frame ? +(df / floor.mean_abs_drgb_full_frame).toFixed(2) : null,
      resolvable: floor.mean_abs_drgb_sealed_crop ? (dc > floor.mean_abs_drgb_sealed_crop) : null,
    };
  }

  // S60 both clauses, for every configuration that carries its own three arms
  const s60 = {};
  const configs = new Set();
  for (const n of names) {
    const m = n.match(/^(.*?)(?:__)?(?:-)?(shadows_off|key_off|env_off)$/);
    if (m) configs.add(m[1].replace(/[-_]$/, ''));
  }
  for (const c of configs) {
    const pick = (suffix) => names.find((n) => n === `${c}-${suffix}` || n === `${c}_${suffix}` || n === suffix);
    const b = names.find((n) => n === c || n === `${c}-base` || n === 'base');
    const s = pick('shadows_off'), k = pick('key_off'), e = pick('env_off');
    if (!b || !s || !k || !e || !bufs[b] || !bufs[s] || !bufs[k] || !bufs[e]) continue;
    s60[c || 'base'] = {
      arms: { base: b, shadows_off: s, key_off: k, env_off: e },
      sealed_judged_crop: clauses(bufs[b].crop, bufs[s].crop, bufs[k].crop, bufs[e].crop),
      full_frame: clauses(bufs[b].full, bufs[s].full, bufs[k].full, bufs[e].full),
    };
  }

  report.groups[key] = { crop, noise_floor: floor, m6, ablation_vs_control: deltas, s60_clauses: s60 };
}

const text = JSON.stringify(report, null, 1);
if (outPath) { fs.mkdirSync(path.dirname(path.resolve(REPO, outPath)), { recursive: true }); fs.writeFileSync(path.resolve(REPO, outPath), text); console.log(`wrote ${outPath}`); }

// human summary
for (const [key, gr] of Object.entries(report.groups)) {
  console.log(`\n=== ${key} === crop ${JSON.stringify(gr.crop)}  floor(crop) mean|d|rgb=${gr.noise_floor.mean_abs_drgb_sealed_crop} hueSpread=${gr.noise_floor.hue_offset_spread_crop}`);
  console.log('arm'.padEnd(32) + 'CROP hue_off  hL     hS   ret    C_sh   Clocal  Yp_lit Yp_sh | FRAME hue_off  ret    C_sh');
  for (const [arm, v] of Object.entries(gr.m6)) {
    const c = v.sealed_judged_crop, f = v.full_frame;
    console.log(arm.padEnd(32)
      + String(c.hue_offset_deg).padStart(7) + String(c.hue_lit_deg).padStart(8) + String(c.hue_shadow_deg).padStart(8)
      + String(c.retention).padStart(8) + String(c.C_shadow).padStart(8) + String(c.C_local_med).padStart(8)
      + String(c.mean_Yp_lit).padStart(8) + String(c.mean_Yp_shadow).padStart(8)
      + ' | ' + String(f.hue_offset_deg).padStart(7) + String(f.retention).padStart(8) + String(f.C_shadow).padStart(8));
  }
  for (const [c, v] of Object.entries(gr.s60_clauses)) {
    console.log(`  S60 [${c}] crop lit_ratio tau1..16: ${[1, 2, 4, 8, 16].map((t) => v.sealed_judged_crop[`tau${t}`].lit_ratio).join(' ')}`);
    console.log(`  S60 [${c}] frame lit_ratio tau1..16: ${[1, 2, 4, 8, 16].map((t) => v.full_frame[`tau${t}`].lit_ratio).join(' ')}`);
    console.log(`  S60 [${c}] crop cast_shadow_area tau1..16: ${[1, 2, 4, 8, 16].map((t) => v.sealed_judged_crop[`tau${t}`].cast_shadow_area).join(' ')}`);
  }
}
