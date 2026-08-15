#!/usr/bin/env node
/**
 * f7-critic-m12-offline.mjs — F7 CRITIC. RI-VIS03 M12 ON BOTH ARMS, FROM ALREADY-CAPTURED FRAMES.
 *
 * RI-VIS04 §9 names M12 as the detector for the blue-plane failure and calls
 * `FresnelDelta < 0.02` together with `ReflCorr < 0.15` conclusive. `FresnelDelta` is the fix's
 * own thesis stated as a measurement: the defect was that DOWNWARD-viewed water carried the same
 * reflection weight as GRAZING water, and the fix drops the downward weight and leaves grazing
 * alone. If it does what it claims, FresnelDelta must RISE. Nothing in the F7 build ran it.
 *
 * The WATER_MASK is taken from the renderer (base vs `-water-hidden` at the same pose), which is
 * M12's own first choice, not the hand-marked polygon it falls back to.
 *
 *   node tools/visual/f7-critic-m12-offline.mjs --dir reports/visual-truth/f7-critic/look-dm
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const DIR = path.resolve(REPO, String(args.dir || 'reports/visual-truth/f7-critic/look-dm'));
const POSE = String(args.pose || 'c-vista-11-d26');
const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
const V = await import(path.join(REPO, 'tools/metrics/lib/vis03.mjs'));

const F = (n) => path.join(DIR, 'frames', n);
const out = { tool: 'f7-critic-m12-offline', generated: new Date().toISOString(), dir: path.relative(REPO, DIR), pose: POSE, bands: V.M12_BANDS, arms: {} };

for (const arm of ['prefix', 'fixed']) {
  const basePath = F(`${arm}-${POSE}.png`), hidPath = F(`${arm}-${POSE}-water-hidden.png`);
  if (!fs.existsSync(basePath) || !fs.existsSync(hidPath)) { out.arms[arm] = { missing: [basePath, hidPath].filter((p) => !fs.existsSync(p)).map((p) => path.relative(REPO, p)) }; continue; }
  const base = PNG.sync.read(fs.readFileSync(basePath)), hid = PNG.sync.read(fs.readFileSync(hidPath));
  const N = base.width * base.height, water = new Uint8Array(N);
  let wn = 0;
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const d = Math.abs(base.data[p] - hid.data[p]) + Math.abs(base.data[p + 1] - hid.data[p + 1]) + Math.abs(base.data[p + 2] - hid.data[p + 2]);
    if (d > 6) { water[i] = 1; wn++; }
  }
  const seq = [];
  for (let i = 0; i < 8; i++) {
    const p = F(`${arm}-motion-still-${i}.png`);
    if (fs.existsSync(p)) seq.push(V.prepare(PNG.sync.read(fs.readFileSync(p))).Yp);
  }
  const pl = V.prepare(base);
  const m12 = V.M12(pl, water, { sequence: seq });
  const verdict = {};
  for (const [k, band] of Object.entries(V.M12_BANDS)) {
    const v = m12[k];
    verdict[k] = (v === null || v === undefined) ? 'UNMEASURABLE (scored 0 fail-closed)' : (band.min !== undefined ? (v >= band.min ? `PASS (>= ${band.min})` : `FAIL (< ${band.min})`) : 'n/a');
  }
  out.arms[arm] = {
    base_frame: path.relative(REPO, basePath), mask_from: path.relative(REPO, hidPath),
    water_mask_px: wn, water_mask_pct: +(100 * wn / N).toFixed(2), sequence_frames: seq.length,
    m12: Object.fromEntries(Object.entries(m12).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(5) : v])),
    band_verdict: verdict,
  };
}
if (out.arms.prefix?.m12 && out.arms.fixed?.m12) {
  const P = out.arms.prefix.m12, Fx = out.arms.fixed.m12;
  out.fix_effect = {
    FresnelDelta: `${P.FresnelDelta} -> ${Fx.FresnelDelta}`,
    FresnelDelta_must_rise: P.FresnelDelta !== null && Fx.FresnelDelta !== null
      ? (Fx.FresnelDelta > P.FresnelDelta ? 'ROSE — consistent with the fix\'s own thesis' : 'DID NOT RISE — the fix\'s own thesis is not visible in the corpus\'s own water instrument')
      : 'unmeasurable',
    ReflCorr: `${P.ReflCorr} -> ${Fx.ReflCorr}`,
    ShoreDelta: `${P.ShoreDelta} -> ${Fx.ShoreDelta}`,
    NormalEnergy: `${P.NormalEnergy} -> ${Fx.NormalEnergy}`,
    TemporalVar: `${P.TemporalVar} -> ${Fx.TemporalVar}`,
    two_or_more_failing: 'RI-VIS03 M12: "Any two of these failing = water is a blue plane" hard fail; RI-VIS04 §9 §DETECT calls FresnelDelta < 0.02 with ReflCorr < 0.15 conclusive.',
  };
}
const OUT = path.resolve(REPO, args.out || path.join(DIR, 'm12-offline.json'));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ fix_effect: out.fix_effect, prefix: out.arms.prefix?.band_verdict, fixed: out.arms.fixed?.band_verdict, prefix_m12: out.arms.prefix?.m12, fixed_m12: out.arms.fixed?.m12 }, null, 2));
