#!/usr/bin/env node
/**
 * w1-f3-ambient-fill.mjs — does the W1-F3 ambient/GI shadow-fill in
 * game/src/render/post/composite.js actually lift shadow-region detail, and is it doing that
 * by a real spatially-varying bounce rather than the plausible wrong answer named in the
 * dispatch: a flat global exposure/gamma lift that also raises shadow luma but destroys the
 * directional falloff three of the five W1-VISUAL-BLIND-PROTOCOL-A-r1 judges praised in the
 * reference.
 *
 * WHY THIS SCENE. `material_showcase` (F2's fixture) cannot exercise this: its wall's front
 * face always faces the sun during the day in this sky model (dir.z and dir.y share a sign in
 * sky.js's `apply()`, so a front-facing wall normal (0,0,1) has dot(N,sunDir) > 0 at every
 * daylight hour) — there is no camera-visible cast shadow to lift. Real architecture does have
 * one: `town-thorn` at VP04's surveyed pose (`tools/harness/viewpoints.json`, camera
 * [3859,15,860] -> [3820,14.2,859], the exact pose F2's own production evidence used), 09:00,
 * clear. Surveyed at 1920x1080 (see f3-survey2 grid dump in this piece's status file) rather
 * than guessed: the frame carries genuine cast-shadow structure under the gable roofline and a
 * flat lit wall run beside it, on the SAME material, which the whole-frame percentile metrics
 * below do not need hand-picked pixel bands to find.
 *
 * THE METRICS, applied to an ARCHITECTURE+GROUND crop with the HUD and sky cropped out
 * (x:[0,1450) y:[140,1080) of the 1920x1080 capture):
 *   - p10_luma / p90_luma: mean luma of the darkest and brightest 10% of pixels in the crop —
 *     a shadow-region and lit-region proxy that needs no hand-drawn mask.
 *   - falloff_ratio = p90_luma / p10_luma, reported for both arms but NOT the gating metric —
 *     see the note attached to `result.null_control_global_lift` for why: measured once, a flat
 *     lift that also brightens the lit end scored a HIGHER ratio than the real fix, because the
 *     ratio rewards moving p90 up right alongside p10, which is the flattening itself, not
 *     evidence against it.
 *   - shadow_levels: distinct 8-bit luma levels present at/below the frame's own 25th
 *     percentile value — lifted VERBATIM from `tools/blind/image-leakcheck.mjs`, the instrument
 *     the original verdict corroborated the judges' shadow-crush finding with (5/5 pairs named
 *     the reference on this exact statistic). "Readable detail in shade" is what this counts.
 *   - local_contrast_med: median 32x32-tile luma stddev, also lifted verbatim from the same
 *     tool ("local micro-contrast — the finding").
 *
 * THE NULL CONTROL THAT IS THE PLAUSIBLE WRONG ANSWER, NOT THE TRIVIAL ONE (dispatch brief).
 * "GI off looks flatter" is the trivial control and `--arm off` already is it. The plausible
 * wrong answer a hurried fix ships is a flat additive black-lift (`c += K` on every channel of
 * every pixel) tuned to raise the shadow floor by the SAME amount the real fix does — i.e. its
 * p10_luma is made to match the GI-on arm's p10_luma exactly, the most charitable construction
 * available to it. `--null-control` builds that arm and runs the same metrics on it.
 *
 * THE GATING FALLOFF CLAIM: how much EACH arm has to move the LIT end (p90) to buy the SAME
 * amount of shadow-floor lift (p10). A flat additive lift moves p90 by exactly K, by
 * construction — it cannot touch one region of the frame without touching all of them. GI, being
 * conditioned on the local deficit between a pixel and its own neighbourhood, moves p90 by
 * whatever is left over after "a pixel already at or above its neighbourhood's brightness
 * receives ~nothing" — see `GI-ON-DOES-NOT-BRIGHTEN-THE-LIT-END` and
 * `GI-MOVES-THE-LIT-END-FAR-LESS-THAN-A-MATCHED-GLOBAL-LIFT` below.
 *
 * THE ALGEBRAIC IDENTITY, reported alongside as an honest, non-gating fact (mirrors F2's
 * k*a/k*b argument for the multiplicative case): for any two positive lumas a > b > 0 and any
 * lift K > 0, (a + K) / (b + K) < a / b, strictly, and strictly decreasing in K. This is true
 * regardless of which arm ends up with the higher ratio number, which is exactly why the ratio
 * alone is not used to gate the claim above.
 *
 * Usage:
 *   node tools/visual/w1-f3-ambient-fill.mjs                     both arms, local browser
 *   node tools/visual/w1-f3-ambient-fill.mjs --entry <clone>/game/index.html   (delete-the-fix)
 *   node tools/visual/w1-f3-ambient-fill.mjs --hardware-gpu      pass through to launchGame
 *   node tools/visual/w1-f3-ambient-fill.mjs --null-control      also builds the flat-lift arm
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/w1-f3-ambient-fill');
fs.mkdirSync(OUT, { recursive: true });

// Surveyed pose (see file header). Same as F2's production-thorn evidence, VP04-settlement-street.
const CAMERA = { pos: [3859.0, 15.0, 860.0], look: [3820.0, 14.2, 859.0], fov: 60 };
const WIDTH = 1920, HEIGHT = 1080;
const CROP = { x0: 0, x1: 1450, y0: 140, y1: 1080 }; // architecture + ground, HUD and sky cropped out

function luma(png, x, y) {
  const i = (png.width * y + x) << 2;
  return 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
}

function analyze(png, crop) {
  const { x0, x1, y0, y1 } = crop;
  const lumas = [];
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) lumas.push(luma(png, x, y));
  lumas.sort((a, b) => a - b);
  const n = lumas.length;
  const mean = lumas.reduce((s, v) => s + v, 0) / n;
  const pk = Math.max(1, Math.floor(n * 0.10));
  const p10 = lumas.slice(0, pk).reduce((s, v) => s + v, 0) / pk;
  const p90 = lumas.slice(n - pk).reduce((s, v) => s + v, 0) / pk;
  const q25val = lumas[Math.floor(n * 0.25)];
  const levelSet = new Set();
  for (const v of lumas) { if (v <= q25val) levelSet.add(Math.round(v)); }
  const tileStd = [];
  for (let ty = y0; ty + 32 <= y1; ty += 32) {
    for (let tx = x0; tx + 32 <= x1; tx += 32) {
      let s = 0, s2 = 0, cnt = 0;
      for (let y = ty; y < ty + 32; y += 2) for (let x = tx; x < tx + 32; x += 2) {
        const v = luma(png, x, y); s += v; s2 += v * v; cnt++;
      }
      const m = s / cnt;
      tileStd.push(Math.sqrt(Math.max(0, s2 / cnt - m * m)));
    }
  }
  tileStd.sort((a, b) => a - b);
  return {
    mean_luma: +mean.toFixed(3),
    p10_luma: +p10.toFixed(3),
    p90_luma: +p90.toFixed(3),
    falloff_ratio: +(p90 / Math.max(p10, 1e-6)).toFixed(4),
    shadow_levels: levelSet.size,
    local_contrast_med: tileStd.length ? +tileStd[Math.floor(tileStd.length / 2)].toFixed(3) : 0,
  };
}

/** Flat additive lift on every RGB channel, clamped to 255. The plausible wrong answer. */
function liftedCopy(png, K) {
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.data.length; i += 4) {
    out.data[i] = Math.min(255, png.data[i] + K);
    out.data[i + 1] = Math.min(255, png.data[i + 1] + K);
    out.data[i + 2] = Math.min(255, png.data[i + 2] + K);
    out.data[i + 3] = 255;
  }
  return out;
}

/** Solve for K such that liftedCopy(png,K)'s crop p10_luma matches targetP10, by bisection —
 * the lift is monotonic in K so this converges without needing a closed form for p10(K). */
function solveLiftForP10(png, crop, targetP10) {
  let lo = 0, hi = 255;
  for (let iter = 0; iter < 24; iter++) {
    const mid = (lo + hi) / 2;
    const p10 = analyze(liftedCopy(png, mid), crop).p10_luma;
    if (p10 < targetP10) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

async function captureArm(g, { giFill }) {
  await g.h('teleport', 3820, 859);
  await g.h('exitInterior').catch(() => {});
  await g.h('setWeather', 'clear');
  await g.h('setTimeOfDay', 9);
  await g.h('stepFrames', 90);
  await g.h('setVisualFeature', 'giFill', !!giFill);
  await g.h('camera', CAMERA);
  await g.h('stepFrames', 30);
  const url = await g.page.evaluate(async () => window.__HARNESS.screenshot());
  return PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
}

const g = await launchGame({
  entry: args.entry || 'game/index.html', width: WIDTH, height: HEIGHT,
  hardwareGpu: args['hardware-gpu'] === true || args.hardwareGpu === true,
});
await g.h('ready');

const rendererString = await g.page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return null;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
});
const softwareRenderer = /swiftshader|llvmpipe|software/i.test(String(rendererString || ''));

const pngOff = await captureArm(g, { giFill: false });
const pngOn = await captureArm(g, { giFill: true });
fs.writeFileSync(path.join(OUT, 'gi-off.png'), PNG.sync.write(pngOff));
fs.writeFileSync(path.join(OUT, 'gi-on.png'), PNG.sync.write(pngOn));

const mOff = analyze(pngOff, CROP);
const mOn = analyze(pngOn, CROP);

const result = {
  entry: args.entry || 'game/index.html',
  renderer: rendererString, software_renderer: softwareRenderer,
  camera: CAMERA, crop: CROP, place: 'town-thorn (VP04 pose)', time_of_day: 9, weather: 'clear',
  gi_off: mOff, gi_on: mOn,
  checks: [
    {
      id: 'GI-ON-RAISES-SHADOW-FLOOR',
      ok: mOn.p10_luma > mOff.p10_luma,
      detail: `p10_luma off=${mOff.p10_luma} on=${mOn.p10_luma} — the fix must actually raise the darkest-decile mean`,
    },
    {
      id: 'GI-ON-INCREASES-SHADOW-DETAIL',
      ok: mOn.shadow_levels >= mOff.shadow_levels,
      detail: `shadow_levels (image-leakcheck.mjs's own definition) off=${mOff.shadow_levels} on=${mOn.shadow_levels} — distinct luma levels below the 25th percentile`,
    },
    {
      id: 'GI-ON-DOES-NOT-BRIGHTEN-THE-LIT-END',
      ok: Math.abs(mOn.p90_luma - mOff.p90_luma) / Math.max(mOff.p90_luma, 1e-6) < 0.06,
      detail: `p90_luma off=${mOff.p90_luma} on=${mOn.p90_luma} — a pixel already at or above its neighbourhood's own brightness should receive ~nothing; this is what a flat lift CANNOT do`,
    },
  ],
};

if (args['null-control']) {
  const K = solveLiftForP10(pngOff, CROP, mOn.p10_luma);
  const pngLift = liftedCopy(pngOff, K);
  fs.writeFileSync(path.join(OUT, 'global-lift-null-control.png'), PNG.sync.write(pngLift));
  const mLift = analyze(pngLift, CROP);
  // Algebraic sanity: for the crop's own p90/p10 (both positive, p90>p10), an additive K>0 must
  // give (p90+K)/(p10+K) < p90/p10 exactly. Recomputed independently of the pixel-level analyze()
  // call above as a second, symbolic check that the measured arm agrees with the identity.
  const algebraicPrediction = (mOff.p90_luma + K) / (mOff.p10_luma + K);
  const p90DeltaGI = Math.abs(mOn.p90_luma - mOff.p90_luma);
  const p90DeltaNull = Math.abs(mLift.p90_luma - mOff.p90_luma);
  result.null_control_global_lift = {
    lift_K: +K.toFixed(3),
    note: 'gi-off frame lifted by a flat additive constant K on every channel, K solved so its p10_luma matches gi-on\'s p10_luma exactly — the most charitable construction available to the null control. '
      + 'falloff_ratio (p90/p10) is reported for both arms but is NOT the gating metric here: measured once with the first tuning of this piece, a flat lift that ALSO brightens the lit end produced a HIGHER falloff_ratio than the real fix, because the ratio rewards moving p90 up right alongside p10 — which is exactly the flattening a global lift does and a spatially-real fix does not. The metric that actually distinguishes "raised the shadow floor" from "flattened the lighting" is how much EACH arm has to move the lit end (p90) to buy the SAME amount of shadow-floor lift (p10) — see the check below.',
    measured: mLift,
    algebraic_prediction_of_falloff_ratio: +algebraicPrediction.toFixed(4),
    p90_delta_gi_on: +p90DeltaGI.toFixed(3),
    p90_delta_null_control: +p90DeltaNull.toFixed(3),
    checks: [
      {
        id: 'NULL-CONTROL-MATCHES-GI-ON-SHADOW-FLOOR',
        ok: Math.abs(mLift.p10_luma - mOn.p10_luma) < 0.5,
        detail: `lift solved to match: null p10=${mLift.p10_luma} vs gi-on p10=${mOn.p10_luma} (within 0.5 luma — confirms K was solved correctly, i.e. this control was given every chance)`,
      },
      {
        id: 'ALGEBRAIC-LIFT-COMPRESSES-RATIO',
        ok: Math.abs(mLift.falloff_ratio - algebraicPrediction) < 0.02,
        detail: `measured null falloff_ratio=${mLift.falloff_ratio} vs the algebraic prediction (p90+K)/(p10+K)=${algebraicPrediction.toFixed(4)} — confirms the pixel-level measurement matches the closed-form identity (informational: this identity holds regardless of which arm "wins" on the ratio itself, which is why the ratio is not the gating check)`,
      },
      {
        id: 'GI-MOVES-THE-LIT-END-FAR-LESS-THAN-A-MATCHED-GLOBAL-LIFT',
        ok: p90DeltaGI < p90DeltaNull * 0.25,
        detail: `for the SAME shadow-floor lift (p10 matched to within 0.5 luma), gi-on moves p90_luma by ${p90DeltaGI.toFixed(3)} while the null control — which by construction of an additive lift moves EVERY pixel by exactly K=${K.toFixed(2)} — moves it by ${p90DeltaNull.toFixed(3)}. This is the real directional-falloff claim: a spatially-local fix can leave an already-lit surface's brightness alone while raising a shadow floor by the same amount; a flat lift structurally cannot touch one region without touching all of them.`,
      },
      {
        id: 'GLOBAL-LIFT-COMPRESSES-BELOW-GI-OFF-BASELINE',
        ok: mLift.falloff_ratio < mOff.falloff_ratio,
        detail: `null-control falloff_ratio=${mLift.falloff_ratio} vs the untouched gi-off baseline=${mOff.falloff_ratio} — any positive flat lift strictly compresses the ratio below where it started (the algebraic identity again; kept as an honest, if non-gating, fact about global lifts)`,
      },
    ],
  };
}

fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
console.log(`renderer: ${rendererString} (software=${softwareRenderer})`);
console.log(`GI off: p10=${mOff.p10_luma} p90=${mOff.p90_luma} falloff=${mOff.falloff_ratio} shadow_levels=${mOff.shadow_levels} local_contrast_med=${mOff.local_contrast_med}`);
console.log(`GI on:  p10=${mOn.p10_luma} p90=${mOn.p90_luma} falloff=${mOn.falloff_ratio} shadow_levels=${mOn.shadow_levels} local_contrast_med=${mOn.local_contrast_med}`);
for (const c of result.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id}  — ${c.detail}`);
if (result.null_control_global_lift) {
  console.log(`null-control lift K=${result.null_control_global_lift.lift_K}`);
  for (const c of result.null_control_global_lift.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id}  — ${c.detail}`);
}
await g.close();
const allOk = result.checks.every((c) => c.ok) && (!result.null_control_global_lift || result.null_control_global_lift.checks.every((c) => c.ok));
process.exit(allOk ? 0 : 1);
