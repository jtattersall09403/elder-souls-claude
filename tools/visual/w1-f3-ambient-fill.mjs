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
 * READ THIS BEFORE CITING THE TWO-STILL NUMBERS. The original design captured GI-off, then GI-on,
 * and compared. On an RTX A4500 that gave p10_luma 4.641 -> 15.001 and would have been published as a
 * +223% shadow lift. Run against the pinned pre-F3 tree, where the shader is PHYSICALLY ABSENT, the
 * same instrument gave 4.641 -> 14.353: 93.7% of the "improvement" reproduces with no fix in the
 * tree, and SwiftShader reproduces the same 93.7% independently. The block design was measuring
 * capture ORDER. Everything gating in this file is therefore PAIRED — arms interleaved at one pose
 * (`--alternate`), or both arms taken at each pose before the camera moves (`--motion`) — and
 * `result.checks`, the two stills, is written to disk but gates nothing.
 *
 * Usage:
 *   node tools/visual/w1-f3-ambient-fill.mjs --alternate --pairs 6   THE load-bearing measurement
 *   node tools/visual/w1-f3-ambient-fill.mjs --motion               orbit + pan, paired at each pose
 *   node tools/visual/w1-f3-ambient-fill.mjs --null-control         the flat-lift arm (see below)
 *   node tools/visual/w1-f3-ambient-fill.mjs --warmup-curve         characterise the drift itself
 *   node tools/visual/w1-f3-ambient-fill.mjs --entry <clone>/game/index.html --compare-to <head result.json>
 *                                                                   delete-the-fix against a pinned clone
 *   node tools/visual/w1-f3-ambient-fill.mjs --offline-null <dir>    re-derive the null control, no browser
 *   node tools/visual/w1-f3-ambient-fill.mjs --gpu hardware --require-hardware
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

/** `step` subsamples the crop on both axes. Used ONLY by the motion/orbit sweep, where dozens of
 * frames are analysed and the comparison is always within that sweep (arm vs arm at the same step),
 * never against the full-resolution stills above. The stills use step=1. */
function analyze(png, crop, step = 1) {
  const { x0, x1, y0, y1 } = crop;
  const lumas = [];
  for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) lumas.push(luma(png, x, y));
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

/** Flat additive lift on every RGB channel, clamped to 255. The plausible wrong answer.
 *
 * THE LIFT IS QUANTISED AND THAT IS NOT A BUG — it is what an 8-bit frame does. The source channel
 * is an integer, so `round(px + K)` equals `px + round(K)` for every pixel: the achievable lifts are
 * the integers, and p10_luma therefore moves in steps of exactly 1 luma. No K can land it on an
 * arbitrary target. `solveLiftForP10` finds the smallest lift that reaches the target, which
 * OVERSHOOTS by up to one quantum — i.e. the null control is handed slightly MORE shadow lift than
 * the real fix bought, which is the direction that favours the control, not this piece. The rounding
 * is written out rather than left to `Uint8Array`'s implicit truncation so the quantisation is a
 * stated property of the control instead of an accident of the container type. */
function liftedCopy(png, K) {
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.data.length; i += 4) {
    out.data[i] = Math.min(255, Math.round(png.data[i] + K));
    out.data[i + 1] = Math.min(255, Math.round(png.data[i + 1] + K));
    out.data[i + 2] = Math.min(255, Math.round(png.data[i + 2] + K));
    out.data[i + 3] = 255;
  }
  return out;
}

/** Smallest INTEGER lift whose crop p10_luma reaches targetP10.
 *
 * THE SEARCH HAS TO BE OVER INTEGERS, and the continuous version of it was wrong — found by running
 * it, twice. A bisection over real K converges onto the discontinuity itself: for integer channel
 * values `round(px + K)` is `px + 10` just below K = 10.5 and `px + 11` just above, so bisection
 * returns ~10.5, the applied lift is whichever side of the knife-edge floating point lands on, and
 * the algebraic prediction — computed from the real-valued K — then disagrees with the measured
 * frame it is supposed to predict (it did: 4.2986 predicted against 4.4105 measured). The achievable
 * lifts are the integers; searching anything else is searching a set the control cannot reach.
 *
 * Scanning from the analytic guess rather than from 0 keeps this to a couple of `analyze` calls, and
 * the guess is CHECKED rather than trusted — p10 + K is exact only while no dark pixel clips at 255,
 * which is true here but is a property of the frame, not a law. */
function solveLiftForP10(png, crop, targetP10) {
  const base = analyze(png, crop).p10_luma;
  const guess = Math.max(0, Math.floor(targetP10 - base) - 1);
  for (let K = guess; K <= 255; K++) {
    if (analyze(liftedCopy(png, K), crop).p10_luma >= targetP10) return K;
  }
  return 255;
}

/** The whole null control, as a pure function of the gi-off frame and the two arms' metrics — so it
 * can be re-derived by anyone from the two committed PNGs without a browser, a GPU or this repo's
 * state (`--offline-null <dir>` below does exactly that, and it is how the runs captured before this
 * function existed were corrected). */
function buildNullControl(pngOff, crop, mOff, mOn) {
  const K = solveLiftForP10(pngOff, crop, mOn.p10_luma);
  const pngLift = liftedCopy(pngOff, K);
  const mLift = analyze(pngLift, crop);
  // Algebraic sanity: for the crop's own p90/p10 (both positive, p90>p10), an additive K>0 must
  // give (p90+K)/(p10+K) < p90/p10 exactly. Recomputed independently of the pixel-level analyze()
  // call above as a second, symbolic check that the measured arm agrees with the identity.
  const algebraicPrediction = (mOff.p90_luma + K) / (mOff.p10_luma + K);
  const p90DeltaGI = Math.abs(mOn.p90_luma - mOff.p90_luma);
  const p90DeltaNull = Math.abs(mLift.p90_luma - mOff.p90_luma);
  const p10Excess = mLift.p10_luma - mOn.p10_luma;
  const block = {
    lift_K: +K.toFixed(3),
    note: 'gi-off frame lifted by a flat additive constant K on every channel, K solved to be the SMALLEST lift that reaches gi-on\'s p10_luma — the most charitable construction available to the null control. '
      + 'An 8-bit additive lift is quantised to whole luma levels (see liftedCopy), so it cannot land exactly on the target and instead overshoots by up to one level; the overshoot is in the control\'s favour and the check below is written to require exactly that. '
      + 'falloff_ratio (p90/p10) is reported for both arms but is NOT the gating metric here: measured once with the first tuning of this piece, a flat lift that ALSO brightens the lit end produced a HIGHER falloff_ratio than the real fix, because the ratio rewards moving p90 up right alongside p10 — which is exactly the flattening a global lift does and a spatially-real fix does not. The metric that actually distinguishes "raised the shadow floor" from "flattened the lighting" is how much EACH arm has to move the lit end (p90) to buy the SAME amount of shadow-floor lift (p10) — see the check below.',
    measured: mLift,
    algebraic_prediction_of_falloff_ratio: +algebraicPrediction.toFixed(4),
    p90_delta_gi_on: +p90DeltaGI.toFixed(3),
    p90_delta_null_control: +p90DeltaNull.toFixed(3),
    p10_excess_given_to_the_control: +p10Excess.toFixed(3),
    checks: [
      {
        id: 'NULL-CONTROL-GETS-AT-LEAST-GI-ONS-SHADOW-FLOOR',
        ok: p10Excess >= -0.01 && p10Excess <= 1.05,
        detail: `null p10=${mLift.p10_luma} vs gi-on p10=${mOn.p10_luma}: the control was given ${p10Excess >= 0 ? `${p10Excess.toFixed(3)} luma MORE` : `${(-p10Excess).toFixed(3)} luma LESS`} shadow lift than the fix bought. `
          + 'Must be non-negative (the control is never short-changed) and within one 8-bit quantum (1.0 luma) so it is not handed an unearned advantage either. '
          + 'THIS CHECK WAS FOUND FAILING BY RUNNING IT: it originally demanded a match within 0.5 luma, which an integer-quantised lift can never deliver — measured p10 4.734 -> 15.734 at K=11 against a target of 15.116. That was the check being wrong about arithmetic, not the control being wrong about lighting.',
      },
      {
        id: 'ALGEBRAIC-LIFT-COMPRESSES-RATIO',
        ok: Math.abs(mLift.falloff_ratio - algebraicPrediction) < 0.02,
        detail: `measured null falloff_ratio=${mLift.falloff_ratio} vs the algebraic prediction (p90+K)/(p10+K)=${algebraicPrediction.toFixed(4)} — confirms the pixel-level measurement matches the closed-form identity (informational: this identity holds regardless of which arm "wins" on the ratio itself, which is why the ratio is not the gating check)`,
      },
      {
        id: 'GI-MOVES-THE-LIT-END-FAR-LESS-THAN-A-MATCHED-GLOBAL-LIFT',
        ok: p90DeltaGI < p90DeltaNull * 0.25,
        detail: `for the SAME shadow-floor lift (p10 matched to within one 8-bit quantum), gi-on moves p90_luma by ${p90DeltaGI.toFixed(3)} while the null control — which by construction of an additive lift moves EVERY pixel by exactly K=${K.toFixed(2)} — moves it by ${p90DeltaNull.toFixed(3)}. This is the real directional-falloff claim: a spatially-local fix can leave an already-lit surface's brightness alone while raising a shadow floor by the same amount; a flat lift structurally cannot touch one region without touching all of them.`,
      },
      {
        id: 'GLOBAL-LIFT-COMPRESSES-BELOW-GI-OFF-BASELINE',
        ok: mLift.falloff_ratio < mOff.falloff_ratio,
        detail: `null-control falloff_ratio=${mLift.falloff_ratio} vs the untouched gi-off baseline=${mOff.falloff_ratio} — any positive flat lift strictly compresses the ratio below where it started (the algebraic identity again; kept as an honest, if non-gating, fact about global lifts)`,
      },
    ],
  };
  return { block, pngLift };
}

// ---- offline: re-derive the null control from two committed PNGs, no browser ---------------------
// Every input the null control needs is in the evidence pack itself, so a reader with the repo and
// nothing else can reproduce it — and a run whose null control was computed by an older, wrong
// version of the check can be corrected without paying for the captures again.
if (args['offline-null']) {
  const dir = path.resolve(REPO, String(args['offline-null']));
  const res = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8'));
  const off = PNG.sync.read(fs.readFileSync(path.join(dir, 'gi-off.png')));
  const crop = res.crop;
  const { block, pngLift } = buildNullControl(off, crop, res.gi_off, res.gi_on);
  fs.writeFileSync(path.join(dir, 'global-lift-null-control.png'), PNG.sync.write(pngLift));
  block.recomputed_offline_from = ['gi-off.png', 'result.json'];
  res.null_control_global_lift = block;
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(res, null, 2));
  console.log(`offline null control for ${dir}: K=${block.lift_K}`);
  for (const c of block.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id}  — ${c.detail}`);
  process.exit(block.checks.every((c) => c.ok) ? 0 : 1);
}

/** THE DELETE-THE-FIX ARM CANNOT SET THIS SWITCH, AND THAT IS THE POINT. On a clone restored to the
 * pinned pre-F3 baseline, `renderer.setVisualFeature` throws `unknown renderer feature 'giFill'`
 * (it validates against `this.quality`, which has no such key before F3). Swallowing that is not
 * leniency — it is how the control arm reports "the fix is genuinely absent from this tree" instead
 * of dying. `gi_feature_present` records which happened, and `--compare-to` gates on it. */
// NOTE, found by running it and not by reading the code: `g.h()` from tools/lib/browser.mjs does NOT
// throw on an in-page error — it calls `die()`, which exits the whole process (EXIT 12,
// HARNESS_ERROR). So a try/catch around `g.h('setVisualFeature', …)` is dead code, and the first
// version of this function was exactly that: the control run died with
// `setVisualFeature() threw: unknown renderer feature 'giFill'` instead of recording the absence.
// The evaluate has to happen in the page, where the throw is catchable.
let giFeaturePresent = null;
async function setGI(g, on) {
  const res = await g.page.evaluate(async (enabled) => {
    try { await window.__HARNESS.setVisualFeature('giFill', enabled); return { ok: true }; }
    catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
  }, !!on);
  if (res.ok) {
    if (giFeaturePresent === null) giFeaturePresent = true;
    return true;
  }
  if (!/unknown renderer feature/i.test(res.err)) {
    throw new Error(`setVisualFeature('giFill') failed for a reason that is NOT "the fix is absent": ${res.err}`);
  }
  giFeaturePresent = false;
  return false;
}

async function shoot(g) {
  const url = await g.page.evaluate(async () => window.__HARNESS.screenshot());
  return PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
}

/** `preroll` is the number of frames stepped after the teleport before anything is measured. It is a
 * parameter rather than a constant because the warm-up curve has to start at the teleport itself:
 * `deck.mjs`, which produced our side of the blind comparison pack, settles `deck.json`'s
 * `settle_frames: 12` and no more, so a curve that begins 90 frames in cannot say anything about the
 * state the judges were actually shown. */
async function placeScene(g, preroll = 90) {
  await g.h('teleport', 3820, 859);
  await g.h('exitInterior').catch(() => {});
  await g.h('setWeather', 'clear');
  await g.h('setTimeOfDay', 9);
  if (preroll > 0) await g.h('stepFrames', preroll);
}

async function captureArm(g, { giFill }) {
  await placeScene(g);
  await setGI(g, giFill);
  await g.h('camera', CAMERA);
  await g.h('stepFrames', 30);
  return shoot(g);
}

// ---- motion and multiple angles ---------------------------------------------------------------
// The dispatch brief, and the owner directive it quotes: "stills are not enough". Shadow fill is
// precisely the kind of change that reads fine in one still and bands or crawls once the camera
// moves, and F2 shipped on stills alone (recorded against it by the orchestrator). Two sweeps:
//
//   ORBIT — the camera circles the SAME look point at a fixed radius, so the claim "the shadow floor
//   lifts and the lit end does not" is tested against many different surfaces, sun-relative angles
//   and occluder geometries rather than one favourable framing. A fix that only works from the
//   surveyed pose fails here.
//
//   FINE SWEEP — small (1.5 degree) yaw increments around the base pose, i.e. adjacent frames of an
//   actual camera pan. The instability this is built to catch is TEMPORAL: a screen-space bounce
//   term whose kernel reprojection is unstable makes the shadow floor swim frame to frame. Metric is
//   the mean absolute successive difference (MASD) of p10_luma along the sweep, compared BETWEEN
//   arms — GI on must not be materially noisier than GI off, which is the untouched baseline for
//   whatever camera/foliage jitter the scene already has (HAZARDS.md §8: only within-arm comparison
//   across a noisy axis carries signal, so the arms are compared on their own noise, not on a diff).
const ORBIT_CENTRE = [3820.0, 14.2, 859.0];
const ORBIT_RADIUS = Math.hypot(CAMERA.pos[0] - ORBIT_CENTRE[0], CAMERA.pos[2] - ORBIT_CENTRE[2]);
const ORBIT_HEIGHT = CAMERA.pos[1];
const MOTION_STEP = 3; // subsample: within-sweep comparison only, see analyze()

function orbitPose(deg) {
  const t = (deg * Math.PI) / 180;
  return {
    pos: [ORBIT_CENTRE[0] + ORBIT_RADIUS * Math.cos(t), ORBIT_HEIGHT, ORBIT_CENTRE[2] + ORBIT_RADIUS * Math.sin(t)],
    look: ORBIT_CENTRE.slice(), fov: CAMERA.fov,
  };
}

/** Yaw the look direction by `deg` about the base pose's own position — a camera pan, not a move. */
function pannedPose(deg) {
  const dx = CAMERA.look[0] - CAMERA.pos[0], dz = CAMERA.look[2] - CAMERA.pos[2];
  const t = (deg * Math.PI) / 180;
  return {
    pos: CAMERA.pos.slice(),
    look: [CAMERA.pos[0] + dx * Math.cos(t) - dz * Math.sin(t), CAMERA.look[1], CAMERA.pos[2] + dx * Math.sin(t) + dz * Math.cos(t)],
    fov: CAMERA.fov,
  };
}

/** ONE placeScene, and BOTH ARMS TAKEN AT EACH POSE BEFORE MOVING ON.
 *
 * The first version of this ran the whole off sweep and then the whole on sweep, which is the same
 * block ordering that the hardware delete-the-fix proved is confounded here (see `alternate()`), and
 * it showed: the first capture of each block came back 14.321 (off block) and 5.276 (on block) at the
 * SAME orbit angle, both outliers against their own neighbours, the direction essentially arbitrary.
 * Pairing at the pose removes it — whatever is still settling is settling equally for two captures
 * taken a few frames apart, so it cancels in the per-angle difference, which is the only number this
 * sweep is asked for. */
async function pairedSweep(g, poses, { save = null, settleBetweenArms = 4 } = {}) {
  await placeScene(g);
  await g.h('camera', poses[0].pose);
  await g.h('stepFrames', 240); // warm once, before any measurement, exactly as `alternate()` does
  const rows = [];
  for (let i = 0; i < poses.length; i++) {
    await g.h('camera', poses[i].pose);
    await g.h('stepFrames', poses[i].settle ?? 4);
    await setGI(g, false);
    await g.h('stepFrames', settleBetweenArms);
    const pngOffP = await shoot(g);
    await setGI(g, true);
    await g.h('stepFrames', settleBetweenArms);
    const pngOnP = await shoot(g);
    if (save) {
      fs.writeFileSync(path.join(save, `${poses[i].label}-gi-off.png`), PNG.sync.write(pngOffP));
      fs.writeFileSync(path.join(save, `${poses[i].label}-gi-on.png`), PNG.sync.write(pngOnP));
    }
    rows.push({
      label: poses[i].label,
      off: analyze(pngOffP, CROP, MOTION_STEP),
      on: analyze(pngOnP, CROP, MOTION_STEP),
    });
  }
  return rows;
}

const masd = (xs) => (xs.length < 2 ? 0 : xs.slice(1).reduce((s, v, i) => s + Math.abs(v - xs[i]), 0) / (xs.length - 1));

// ---- the alternating arm, and why the two-still design above cannot be trusted -----------------
//
// THE FAILURE THIS EXISTS TO REPAIR, measured on an RTX A4500 and not reasoned about. The still
// design captures GI-off first and GI-on second, one after the other. Run against the pinned pre-F3
// tree — where the fix is physically absent and `setVisualFeature('giFill')` throws — the two
// captures still came out at p10_luma 4.641 then 14.353. The head tree gave 4.641 then 15.001. So
// 9.712 of the head run's 10.360 "improvement" — 93.7% of it — is reproduced by a tree with NO FIX
// IN IT. Whatever the second capture is measuring, it is overwhelmingly something that changes
// between the first `captureArm` and the second, and only marginally the shader. That is RULES rule
// 6's third and worst shape: an inert-looking fix whose number moves the right way anyway. The
// delete-the-fix control is the only reason it was caught, which is the entire argument for the
// control.
//
// THE REPAIR IS PAIRING, NOT MORE FRAMES. The confound is capture ORDER, so the arms have to be
// interleaved rather than run in blocks: warm the scene once, then alternate off / on / off / on at
// one fixed pose, several times, with equal settle between every capture. Any monotone warm-up drift
// now lands on BOTH arms equally and cancels in the paired difference, and the drift itself is
// visible in the off-series. The claim becomes a paired one — "at matched scene age, the GI-on frame
// is brighter in shadow than the GI-off frame immediately before it, every time" — which is a claim
// the block design was never able to make.
//
// AND IT CARRIES ITS OWN INERT-CONTROL ARM. On the pinned-baseline tree the toggle does nothing, so
// the same alternation there is just consecutive captures of one unchanging tree: its paired
// difference must collapse to ~0. A control that has never been seen to differ from the experiment
// is a second copy of the experiment (RULES rule 6), and this one is watched.
async function alternate(g, { pairs, settle, warmup = 240, giFirst = false }) {
  await placeScene(g);
  // `--gi-first --warmup 0` reproduces the ORDER OF HARNESS CALLS that lands a run in the dark
  // regime: setGI before the camera pose, and no long settle. Measured as the first capture of a
  // fresh process, that order gives a GI-off floor of 4.63 with shadow_levels 28 and holds it flat
  // from frame 2 to frame 360; the default order (camera, long settle, then setGI) gives 14.29 with
  // shadow_levels 33 — on the pinned-baseline tree too, which has no GI code in it. Which regime the
  // fix is measured in matters, because 28 is the fresh-process number and the blind verdict's own
  // corroboration was that our shadow_levels swept low against the reference on 5 of 5 pairs.
  if (giFirst) await setGI(g, false);
  await g.h('camera', CAMERA);
  if (warmup > 0) await g.h('stepFrames', warmup);
  const off = [], on = [];
  for (let i = 0; i < pairs; i++) {
    await setGI(g, false);
    await g.h('stepFrames', settle);
    off.push(analyze(await shoot(g), CROP, MOTION_STEP));
    await setGI(g, true);
    await g.h('stepFrames', settle);
    on.push(analyze(await shoot(g), CROP, MOTION_STEP));
  }
  return { off, on };
}

// `--gpu hardware` is the spelling the rest of the fleet's GPU tools use (deck.mjs,
// deck-motion.mjs, opening-capture.mjs, and gpu-deck.mjs's generated Pod command); `--hardware-gpu`
// is kept because this file's own header documented it. Both mean the same thing.
const wantsHardware = args['hardware-gpu'] === true || args.hardwareGpu === true
  || String(args.gpu || '').toLowerCase() === 'hardware';
const g = await launchGame({
  entry: args.entry || 'game/index.html', width: WIDTH, height: HEIGHT, hardwareGpu: wantsHardware,
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
// A Pod that silently falls back to SwiftShader produces a run that LOOKS like hardware evidence and
// is not — the exact failure `classifyRenderer` in gpu-deck.mjs was written for. A paid run must die
// here rather than write a plausible result.json (dispatch brief item 2: a software renderer is
// worthless for appearance claims).
if (args['require-hardware'] && softwareRenderer) {
  await g.close();
  throw new Error(`--require-hardware was set and the renderer is "${rendererString}" — this run would be software evidence wearing a hardware label`);
}

// ---- the warm-up curve, and PLACEMENT IS THE WHOLE EXPERIMENT -----------------------------------
//
// THIS BLOCK USED TO SIT AFTER THE TWO STILLS, AND THAT MADE IT BLIND. Its first sample was then the
// process's THIRD capture, by which point whatever the stills had caught was already over. Two
// hypotheses were tested with that broken placement — "the scene warms up with age" and "a camera
// jump in an already-running world needs frames to re-converge" — and BOTH came back perfectly flat
// (13 samples, range 0.014 luma, at prerolls 0 and 90 alike). Neither result meant what it looked
// like: neither test was capable of seeing the thing it was aimed at. Recorded because a flat curve
// from a blind instrument reads exactly like a real negative result, and this one was believed twice.
//
// So it now runs BEFORE any other capture and exits immediately after, and sample one really is
// capture one of the process.
//
// GI is held OFF throughout, so nothing here is about F3: this is the untouched scene measured
// against nothing but its own age. `time_of_day` is read at every sample because the world clock was
// the obvious suspect — it is ruled out by a live probe showing 9.000 -> 9.0222 hours across 240
// frames, 40 seconds of game time. `pauseClock` IS exposed at game/src/harness/api.js:195 and NO tool
// under tools/visual/ or tools/harness/ calls it, though HARNESS.md 6 requires the clock pinned for a
// comparable screenshot; that is a real protocol defect whether or not it is this mechanism.
if (args['warmup-curve']) {
  // The schedule starts at 4 and includes 12 on purpose: `deck.json`'s `settle_frames` is 12, and
  // `deck.mjs` — the tool that produced our side of the blind pack — steps 4 after the teleport and
  // then SETTLE, calling `pauseClock` never. Sampling at 12 is the difference between a claim about
  // the pack and an extrapolation toward it.
  const schedule = String(args.schedule || '4,12,20,30,45,60,90,120,180,240,300,420,600').split(',').map(Number);
  // `--preroll N` steps N frames after the teleport BEFORE the camera is posed. It is the whole
  // experiment. With preroll 0 the shadow floor is already 14.29 at frame 4 and stays there through
  // frame 600 — flat, no scene-age drift, which REFUTES the first explanation this piece reached for.
  // With preroll 90 the same scene measured 30 frames after the camera move reads 4.64 and 240 frames
  // after it reads 14.29. So the settling is triggered by a camera JUMP in an already-running world,
  // not by the world being young — and `deck.mjs`, which produced our side of the blind pack, poses
  // its camera and then steps `settle_frames: 12`.
  await placeScene(g, Number(args.preroll || 0));
  await setGI(g, false);
  await g.h('camera', CAMERA);
  const rows = [];
  let elapsed = 0;
  for (const target of schedule) {
    if (target > elapsed) { await g.h('stepFrames', target - elapsed); elapsed = target; }
    const env = await g.h('getEnvironment').catch(() => null);
    const m = analyze(await shoot(g), CROP, MOTION_STEP);
    rows.push({
      frames_since_teleport: elapsed,
      time_of_day: env ? (env.time_of_day ?? env.timeOfDay ?? null) : null,
      p10_luma: m.p10_luma, p90_luma: m.p90_luma, mean_luma: m.mean_luma,
      shadow_levels: m.shadow_levels, local_contrast_med: m.local_contrast_med,
    });
    console.log(`  frame ${String(elapsed).padStart(4)}  t=${rows[rows.length - 1].time_of_day}  p10=${m.p10_luma}  p90=${m.p90_luma}  shadow_levels=${m.shadow_levels}`);
  }
  const p10s = rows.map((r) => r.p10_luma);
  const first = p10s[0], last = p10s[p10s.length - 1];
  const warmupBlock = {
    note: 'GI held OFF throughout — this is the untouched scene measured against nothing but its own age, in frames since the teleport, with the pose set before the first sample. If p10_luma climbs here, every capture this project takes without a warm-up is measuring an unsettled frame.',
    schedule, rows,
    p10_first: first, p10_last: last, p10_range: +(Math.max(...p10s) - Math.min(...p10s)).toFixed(3),
    checks: [
      {
        id: 'WARM-UP-DRIFT-IS-REAL-AND-IS-LARGER-THAN-THE-F3-REMEDY',
        ok: true,
        detail: `REPORTED, NOT GATED — this is a characterisation, not a pass/fail. p10_luma over the sweep: ${JSON.stringify(p10s)}. `
          + `Range ${(Math.max(...p10s) - Math.min(...p10s)).toFixed(3)} luma against F3's own paired effect of ~0.63 luma. Clock movement across the same sweep: ${rows[0].time_of_day} -> ${rows[rows.length - 1].time_of_day} hours.`,
      },
    ],
  };
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({
    entry: args.entry || 'game/index.html', renderer: rendererString, software_renderer: softwareRenderer,
    gi_feature_present: giFeaturePresent, camera: CAMERA, crop: CROP, preroll: Number(args.preroll || 0),
    warmup_curve: warmupBlock,
  }, null, 2));
  await g.close();
  process.exit(0);
}

const pngOff = await captureArm(g, { giFill: false });
const pngOn = await captureArm(g, { giFill: true });
// A headed hardware run (`--hardware-gpu`, which is how the Pod arm runs) gives the page less than
// the requested viewport because the browser's own chrome takes vertical space, so the canvas — and
// therefore the capture — can be smaller than WIDTHxHEIGHT. Clamping the crop to what actually came
// back is the difference between a real measurement and a screenful of NaN read past the buffer.
// The crop is clamped ONCE, from the first capture, so both arms are measured over identical pixels.
if (pngOff.width !== WIDTH || pngOff.height !== HEIGHT) {
  CROP.x1 = Math.min(CROP.x1, pngOff.width);
  CROP.y1 = Math.min(CROP.y1, pngOff.height);
  CROP.y0 = Math.min(CROP.y0, Math.max(0, pngOff.height - 1));
}
if (pngOn.width !== pngOff.width || pngOn.height !== pngOff.height) {
  throw new Error(`the two arms captured at different sizes (${pngOff.width}x${pngOff.height} vs ${pngOn.width}x${pngOn.height}) — they are not comparable`);
}
fs.writeFileSync(path.join(OUT, 'gi-off.png'), PNG.sync.write(pngOff));
fs.writeFileSync(path.join(OUT, 'gi-on.png'), PNG.sync.write(pngOn));

const mOff = analyze(pngOff, CROP);
const mOn = analyze(pngOn, CROP);

const result = {
  entry: args.entry || 'game/index.html',
  renderer: rendererString, software_renderer: softwareRenderer,
  gi_feature_present: giFeaturePresent,
  capture_size: [pngOff.width, pngOff.height], requested_size: [WIDTH, HEIGHT],
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
  const { block, pngLift } = buildNullControl(pngOff, CROP, mOff, mOn);
  fs.writeFileSync(path.join(OUT, 'global-lift-null-control.png'), PNG.sync.write(pngLift));
  result.null_control_global_lift = block;
}


if (args.alternate) {
  const pairs = Number(args.pairs || 6);
  const settle = Number(args.settle || 12);
  const warmup = args.warmup === undefined ? 240 : Number(args.warmup);
  const giFirst = args['gi-first'] === true;
  const { off, on } = await alternate(g, { pairs, settle, warmup, giFirst });
  const diffs = on.map((o, i) => +(o.p10_luma - off[i].p10_luma).toFixed(3));
  const p90diffs = on.map((o, i) => +(o.p90_luma - off[i].p90_luma).toFixed(3));
  const meanDiff = diffs.reduce((s, v) => s + v, 0) / diffs.length;
  const meanP90Diff = p90diffs.reduce((s, v) => s + v, 0) / p90diffs.length;
  const offSeries = off.map((o) => o.p10_luma);
  const drift = Math.max(...offSeries) - Math.min(...offSeries);
  const allPositive = diffs.every((d) => d > 0);
  const smallest = Math.min(...diffs);
  result.alternating = {
    note: 'off/on interleaved at ONE pose after a single 240-frame warm-up, so capture-order drift lands on both arms and cancels in the paired difference. This replaces the two-still block comparison as the load-bearing measurement — see the comment on `alternate()` for the RTX A4500 numbers that killed the block design.',
    pairs, settle_frames: settle, subsample_step: MOTION_STEP, warmup_frames: warmup, gi_set_before_camera: giFirst,
    p10_off_series: offSeries, p10_on_series: on.map((o) => o.p10_luma),
    paired_p10_differences: diffs, paired_p90_differences: p90diffs,
    mean_paired_p10_difference: +meanDiff.toFixed(3),
    mean_paired_p90_difference: +meanP90Diff.toFixed(3),
    off_series_drift_range: +drift.toFixed(3),
    // THE TWO STATISTICS THE BLIND VERDICT ITSELF USED. W1-VISUAL-BLIND-PROTOCOL-A-r1 corroborated
    // its judges with exactly these two from `image-leakcheck.mjs` — `shadow_levels` (5/5 pairs named
    // the reference) is cluster C, this remedy's own cluster, and R3's stated acceptance is phrased
    // in it; `local_contrast_med` (5/5) is cluster A. Carrying them here, paired, means the piece is
    // measured in the verdict's vocabulary rather than only in one it invented for itself — and it
    // is the only way to see whether the fill buys shadow detail at the price of micro-contrast.
    shadow_levels_off_series: off.map((o) => o.shadow_levels),
    shadow_levels_on_series: on.map((o) => o.shadow_levels),
    mean_paired_shadow_levels_difference: +(on.reduce((s, o, i) => s + (o.shadow_levels - off[i].shadow_levels), 0) / on.length).toFixed(3),
    local_contrast_med_off_series: off.map((o) => o.local_contrast_med),
    local_contrast_med_on_series: on.map((o) => o.local_contrast_med),
    mean_paired_local_contrast_difference: +(on.reduce((s, o, i) => s + (o.local_contrast_med - off[i].local_contrast_med), 0) / on.length).toFixed(3),
    gi_feature_present: giFeaturePresent,
    checks: [
      {
        id: 'PAIRED-GI-LIFT-IS-POSITIVE-EVERY-TIME',
        ok: giFeaturePresent === true ? allPositive : true,
        detail: giFeaturePresent === true
          ? `every one of ${pairs} pairs has p10(on) > p10(off); smallest paired lift ${smallest}, mean ${meanDiff.toFixed(3)} luma. Series: ${JSON.stringify(diffs)}`
          : `NOT APPLICABLE — this tree has no giFill switch, so this run is the inert-control arm and is judged by PAIRED-DIFFERENCE-COLLAPSES-WITHOUT-THE-FIX instead`,
      },
      {
        id: 'PAIRED-LIFT-EXCEEDS-THE-WARM-UP-DRIFT-IT-REPLACED',
        ok: giFeaturePresent === true ? meanDiff > drift : true,
        detail: `mean paired lift ${meanDiff.toFixed(3)} luma against ${drift.toFixed(3)} luma of total drift across the whole GI-off series. The block design failed precisely because its "effect" was smaller than its drift; this check refuses to repeat that.`,
      },
      {
        id: 'PAIRED-DIFFERENCE-COLLAPSES-WITHOUT-THE-FIX',
        ok: giFeaturePresent === false ? Math.abs(meanDiff) < 0.5 : true,
        detail: giFeaturePresent === false
          ? `the giFill switch does not exist on this tree, so the alternation is just consecutive captures of one unchanging tree: mean paired difference ${meanDiff.toFixed(3)} luma (must be under 0.5). This is the inert-control arm — if it does NOT collapse, the alternating instrument is measuring its own procedure and not the shader.`
          : 'NOT APPLICABLE — this tree has the fix; the control arm is the run against the pinned-baseline clone',
      },
      {
        id: 'PAIRED-SHADOW-LEVELS-MOVE-THE-WAY-THE-VERDICT-ASKED',
        ok: giFeaturePresent === true
          ? on.every((o, i) => o.shadow_levels >= off[i].shadow_levels)
          : true,
        detail: giFeaturePresent === true
          ? `shadow_levels, the statistic R3's acceptance is written in and the one 5/5 blind pairs named the reference on: off ${JSON.stringify(off.map((o) => o.shadow_levels))} -> on ${JSON.stringify(on.map((o) => o.shadow_levels))}, mean paired change ${(on.reduce((s, o, i) => s + (o.shadow_levels - off[i].shadow_levels), 0) / on.length).toFixed(3)}. Must not go DOWN in any pair.`
          : 'NOT APPLICABLE — inert-control tree',
      },
      {
        id: 'PAIRED-LIT-END-IS-UNMOVED',
        ok: Math.abs(meanP90Diff) < 1.0,
        detail: `mean paired p90 difference ${meanP90Diff.toFixed(3)} luma — the lit end must not move when the shadow floor does, which is what separates this from a global lift`,
      },
    ],
  };
  console.log(`alternating (${pairs} pairs, settle ${settle}): mean paired p10 lift ${meanDiff.toFixed(3)}, off-series drift ${drift.toFixed(3)}, mean paired p90 ${meanP90Diff.toFixed(3)}`);
  console.log(`  off: ${JSON.stringify(offSeries)}`);
  console.log(`  on : ${JSON.stringify(on.map((o) => o.p10_luma))}`);
  for (const c of result.alternating.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id}  — ${c.detail}`);
}

if (args.motion) {
  const frames = path.join(OUT, 'motion');
  fs.mkdirSync(frames, { recursive: true });
  const orbitDeg = Number(args['orbit-step'] || 45);
  const orbitPoses = [];
  for (let d = 0; d < 360; d += orbitDeg) orbitPoses.push({ label: `orbit-${String(d).padStart(3, '0')}`, pose: orbitPose(d), settle: 8 });
  const panN = Number(args['pan-frames'] || 12);
  const panPoses = [];
  for (let i = 0; i < panN; i++) panPoses.push({ label: `pan-${String(i).padStart(2, '0')}`, pose: pannedPose(i * 1.5), settle: 2 });

  const orbitRows = await pairedSweep(g, orbitPoses, { save: frames });
  const panRows = await pairedSweep(g, panPoses);

  const perAngle = orbitRows.map((r) => ({
    angle: r.label,
    p10_off: r.off.p10_luma, p10_on: r.on.p10_luma, p10_lift: +(r.on.p10_luma - r.off.p10_luma).toFixed(3),
    p90_off: r.off.p90_luma, p90_on: r.on.p90_luma,
    mean_off: r.off.mean_luma, mean_on: r.on.mean_luma,
    shadow_levels_off: r.off.shadow_levels, shadow_levels_on: r.on.shadow_levels,
  }));
  const anglesLifted = perAngle.filter((r) => r.p10_on > r.p10_off).length;
  const worstP90Drift = Math.max(...perAngle.map((r) => Math.abs(r.p90_on - r.p90_off) / Math.max(r.p90_off, 1e-6)));
  const masdOff = masd(panRows.map((r) => r.off.p10_luma));
  const masdOn = masd(panRows.map((r) => r.on.p10_luma));

  result.motion = {
    note: 'stills are not enough (owner directive, 2026-08-14). BOTH ARMS ARE TAKEN AT EACH POSE BEFORE THE CAMERA MOVES (see pairedSweep) — the earlier block ordering was confounded and its numbers are not in this file. Orbit = the same look point seen from '
      + `${orbitPoses.length} camera positions ${ORBIT_RADIUS.toFixed(1)}m out; pan = ${panN} adjacent frames of a 1.5-degree-per-frame yaw, i.e. what a moving camera actually sees. `
      + `Motion frames are analysed on a ${MOTION_STEP}x subsample of the same crop, so their absolute numbers are NOT comparable with the full-resolution stills above — only arm-vs-arm within this section.`,
    orbit_radius_m: +ORBIT_RADIUS.toFixed(2), orbit_centre: ORBIT_CENTRE, subsample_step: MOTION_STEP,
    per_angle: perAngle,
    pan_p10_off: panRows.map((r) => r.off.p10_luma), pan_p10_on: panRows.map((r) => r.on.p10_luma),
    pan_masd_p10_off: +masdOff.toFixed(4), pan_masd_p10_on: +masdOn.toFixed(4),
    checks: [
      {
        id: 'GI-LIFTS-THE-SHADOW-FLOOR-AT-EVERY-ANGLE',
        ok: giFeaturePresent === false ? true : anglesLifted === perAngle.length,
        detail: giFeaturePresent === false
          ? `NOT APPLICABLE — no giFill switch on this tree; per-angle lifts here are the inert-control arm: ${JSON.stringify(perAngle.map((r) => r.p10_lift))}`
          : `${anglesLifted}/${perAngle.length} orbit angles have p10_luma(on) > p10_luma(off), each pair taken back-to-back AT that angle. Per-angle lifts: ${JSON.stringify(perAngle.map((r) => r.p10_lift))}. A fix that only works from the one surveyed pose fails here.`,
      },
      {
        id: 'GI-LEAVES-THE-LIT-END-ALONE-AT-EVERY-ANGLE',
        ok: worstP90Drift < 0.06,
        detail: `worst-case |p90 drift| across all orbit angles = ${(worstP90Drift * 100).toFixed(2)}% (must stay under 6%, the same threshold the still uses) — the still's lit-end stability is not a lucky framing.`,
      },
      {
        id: 'PER-ANGLE-LIFT-COLLAPSES-WITHOUT-THE-FIX',
        ok: giFeaturePresent === false
          ? perAngle.every((r) => Math.abs(r.p10_lift) < 0.5)
          : true,
        detail: giFeaturePresent === false
          ? `inert-control arm: with the fix physically absent the toggle is a no-op, so every per-angle "lift" must be noise — largest |lift| ${Math.max(...perAngle.map((r) => Math.abs(r.p10_lift))).toFixed(3)} luma (bar: 0.5)`
          : 'NOT APPLICABLE — this tree has the fix; the collapse is checked on the pinned-baseline clone',
      },
      {
        id: 'GI-DOES-NOT-CRAWL-UNDER-CAMERA-MOTION',
        ok: masdOn <= Math.max(masdOff * 1.5, masdOff + 0.5),
        detail: `frame-to-frame mean absolute successive difference of p10_luma along a 1.5-degree-per-frame pan: off=${masdOff.toFixed(4)}, on=${masdOn.toFixed(4)}. `
          + 'The GI-off arm is the scene\'s OWN motion noise (foliage, sub-pixel sampling, TAA-free aliasing — HAZARDS.md §8), so the bar is "GI adds no material instability on top of it", not "GI is perfectly still".',
      },
    ],
  };
  console.log(`motion: ${anglesLifted}/${perAngle.length} angles lifted, worst p90 drift ${(worstP90Drift * 100).toFixed(2)}%, pan MASD off=${masdOff.toFixed(3)} on=${masdOn.toFixed(3)}`);
  for (const c of result.motion.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id}  — ${c.detail}`);
}

// ---- delete-the-fix: this run is a pinned-baseline clone, compared against the head run ---------
// RULES rule 6 / the five non-negotiables: a fix is not a fix until it has been deleted on a copy and
// the OLD number has come back. HAZARDS.md §12 is why the clone must come from the PINNED sha and not
// from HEAD — a sibling's whole-tree bank carries an uncommitted edit into HEAD and turns this green
// for the wrong reason. The two claims below are deliberately different: (1) the fix is really gone
// from the control tree (the feature switch does not exist at all), and (2) the control's shadow floor
// is back at the head run's GI-OFF number and nowhere near its GI-ON number.
if (args['compare-to']) {
  // The head run may still be in flight when this control finishes (they are deliberately run in
  // parallel on one box). Losing a completed set of captures to a missing comparison file would be
  // absurd, so the raw numbers are written either way and the failure is stated, not swallowed.
  const headPath = path.resolve(REPO, args['compare-to']);
  const head = fs.existsSync(headPath) ? JSON.parse(fs.readFileSync(headPath, 'utf8')) : null;
  if (!head) {
    result.delete_the_fix = {
      error: `compare-to file not present when this run finished: ${headPath}. This run's own numbers above are intact; re-derive the comparison from the head run's result.json by hand.`,
      control_p10: mOn.p10_luma, gi_feature_present: giFeaturePresent,
      checks: [{ id: 'HEAD-RUN-RESULT-AVAILABLE', ok: false, detail: 'the head run had not written result.json yet' }],
    };
  } else {
  const ctrl = mOn.p10_luma; // on this tree both "arms" are the same tree; use the second capture
  const headOff = head.gi_off.p10_luma, headOn = head.gi_on.p10_luma;
  const distOff = Math.abs(ctrl - headOff), distOn = Math.abs(ctrl - headOn);
  result.delete_the_fix = {
    compared_to: args['compare-to'],
    head_renderer: head.renderer, head_software_renderer: head.software_renderer,
    control_p10: ctrl, head_gi_off_p10: headOff, head_gi_on_p10: headOn,
    note: 'the control tree is the pinned pre-F3 baseline (HAZARDS.md §12: pinned sha, NOT HEAD). Both of this run\'s captures are the same tree because the giFill switch does not exist there — which is itself check 1.',
    checks: [
      {
        id: 'FIX-IS-ACTUALLY-ABSENT-FROM-THE-CONTROL-TREE',
        ok: giFeaturePresent === false,
        detail: `renderer.setVisualFeature('giFill') ${giFeaturePresent === false ? 'threw \'unknown renderer feature\' — the fix is genuinely torn out' : 'SUCCEEDED, so this tree still has the fix and nothing below means anything'}`,
      },
      {
        id: 'OLD-NUMBER-COMES-BACK-PAIRED',
        ok: giFeaturePresent === false
          && !!(result.alternating && head.alternating)
          && Math.abs(result.alternating.mean_paired_p10_difference) < 0.5
          && head.alternating.mean_paired_p10_difference > 1.0,
        detail: (result.alternating && head.alternating)
          ? `mean PAIRED p10 lift: this control tree ${result.alternating.mean_paired_p10_difference} luma, head tree ${head.alternating.mean_paired_p10_difference} luma. Removing the fix must collapse the paired lift to nothing.`
          : 'CANNOT BE EVALUATED — one or both runs lack the alternating arm, and the block comparison it replaces is known-confounded (see below); re-run both with --alternate',
      },
      {
        id: 'BLOCK-COMPARISON-IS-CONFOUNDED-AND-IS-NOT-EVIDENCE',
        ok: true,
        detail: `RECORDED, NOT GATED. The old block-design claim was "the control's second capture returns to the head run's GI-OFF number". It does not: control second capture=${ctrl}, head GI-OFF=${headOff} (distance ${distOff.toFixed(3)}), head GI-ON=${headOn} (distance ${distOn.toFixed(3)}). `
          + 'That is not the fix surviving its own removal — it is the block design measuring capture ORDER. The first capture of both trees is identical; only the second diverges, on a tree where the shader is physically absent. This row exists so the confound stays visible in the evidence instead of being quietly deleted once a better instrument replaced it.',
      },
      {
        id: 'BOTH-ARMS-ON-THE-SAME-RENDERER',
        ok: String(head.renderer || '') === String(rendererString || ''),
        detail: `control renderer "${rendererString}" vs head run renderer "${head.renderer}" — two arms on two different renderers are not comparable (dispatch brief item 2)`,
      },
    ],
  };
  }
  for (const c of result.delete_the_fix.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id}  — ${c.detail}`);
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
// On a --compare-to (delete-the-fix) run the primary checks are EXPECTED to fail — the whole point is
// that the tree has no fix in it — so gating on them would make a correct control look broken. That
// run is gated on its own delete-the-fix checks instead, and on nothing else.
// `result.checks` — the two stills — is the BLOCK design: GI-off captured first, GI-on captured
// second. That design was measured on an RTX A4500 to reproduce 93.7% of its own effect on a tree
// with the fix deleted, so it is still written to disk (the frames and the confound are both worth
// having on file) and it NO LONGER GATES ANYTHING. A green from a known-confounded arm is exactly the
// kind of reassurance this project has been burned by. `result.motion` does gate, because
// `pairedSweep` takes both arms at each pose before the camera moves.
const alternatingOk = !result.alternating || result.alternating.checks.every((c) => c.ok);
const motionOk = !result.motion || result.motion.checks.every((c) => c.ok);
const allOk = result.delete_the_fix
  ? result.delete_the_fix.checks.every((c) => c.ok) && alternatingOk && motionOk
  : alternatingOk && motionOk
    && (!result.null_control_global_lift || result.null_control_global_lift.checks.every((c) => c.ok));
process.exit(allOk ? 0 : 1);
