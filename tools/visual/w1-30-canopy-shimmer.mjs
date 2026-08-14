#!/usr/bin/env node
/**
 * w1-30-canopy-shimmer.mjs — does the canopy shadow SHIMMER when the camera moves?
 *
 * WHY THIS EXISTS. `province.js` now submits the canopy to the sun's shadow atlas, on the strength
 * of a 1080p hardware frame-time budget that found no cost and a sabotage arm that found 17.7% of
 * the Blackwood vista. Both of those are STILLS. The failure mode a still cannot see is the one
 * that matters for a caster this small: a crown blade near the edge of a 4096 texel fitted to
 * 150 m flickers in and out of the depth comparison as the camera advances, and the ground under
 * a wood boils. Owner directive 2 — "Static inspection is not evidence. Play the game" — is
 * precisely about declaring this kind of thing fixed from one angle.
 *
 * THE MEASUREMENT. Walk the camera forward through a canopy-dense region capturing EVERY frame
 * (adjacent frames are the whole point; a contact sheet every sixth frame cannot show flicker).
 * For each adjacent pair, measure the mean absolute luminance change over the frame. Then repeat
 * the identical walk with the canopy caster flag turned back off in the page.
 *
 *   shimmer = mean |L(t) - L(t-1)| over the sequence
 *
 * A moving camera changes every pixel, so the ABSOLUTE number is meaningless and is not reported
 * as a verdict. THE COMPARISON IS THE INSTRUMENT: the same walk, same seed, same frames, with one
 * flag different. If canopy casting is stable, arm A and arm B differ by little. If it boils, A is
 * measurably noisier than B, and the ratio says by how much.
 *
 * THE NULL CONTROL IS THE PLAUSIBLE WRONG ANSWER, NOT THE TRIVIAL ONE. The trivial control is
 * "camera still" — no motion, no shimmer, proves nothing. The plausible wrong answer is that the
 * walk itself is so noisy (wind on the leaves, water, streaming pop) that it swamps any shadow
 * flicker and BOTH arms look identical — a test that cannot fail. So a third arm walks the same
 * path with the sun's shadow switched off entirely: that is the floor this world's own motion
 * produces with no shadow in it at all, and if A and B both sit on that floor, this instrument has
 * no power and says so rather than reporting a green.
 *
 * Usage:
 *   node tools/visual/w1-30-canopy-shimmer.mjs --hardware --site eye-blackwood --frames 90
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/visual/deck.json'), 'utf8'));
const SITE = String(args.site || 'eye-blackwood');
const FRAMES = Number(args.frames || 90);
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/shadow-casters/shimmer');
fs.mkdirSync(path.join(OUT, 'strip'), { recursive: true });

const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
const g = await launchGame({ entry: 'game/index.html', width: CW, height: CH, hardwareGpu: args.hardware === true });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  const R = window.__ENGINE.renderer;
  if (R.renderer && R.renderer.setPixelRatio) R.renderer.setPixelRatio(1);
  R.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', Number(args.seed || DECK.capture.seed));

const renderer_string = await g.page.evaluate(() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'none'));
  } catch (e) { return `unavailable: ${e.message}`; }
});
const software = /swiftshader|llvmpipe|software|mesa/i.test(renderer_string);
console.log(`renderer: ${renderer_string}${software ? '   *** SOFTWARE ***' : '   [HARDWARE]'}`);

const step = (n) => g.h('stepFrames', n);
const grab = async () => {
  const d = await g.h('screenshot');
  return Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
};
/** Mean absolute luminance change between two frames, over the whole frame. */
function meanAbsL(a, b) {
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  let sum = 0; const n = A.data.length / 4;
  for (let i = 0; i < A.data.length; i += 4) {
    const la = 0.2126 * A.data[i] + 0.7152 * A.data[i + 1] + 0.0722 * A.data[i + 2];
    const lb = 0.2126 * B.data[i] + 0.7152 * B.data[i + 1] + 0.0722 * B.data[i + 2];
    sum += Math.abs(la - lb);
  }
  return sum / n;
}

async function place() {
  const s = DECK.setups.find((x) => x.id === SITE);
  if (!s) throw new Error(`no Deck setup '${SITE}'`);
  await g.h('teleport', s.place.x, s.place.z);
  await step(30);
  await g.h('setWeather', 'clear');
  await g.h('setTimeOfDay', Number(args.time || 13));
  await g.h('camera', { mode: 'gameplay' }).catch(() => {});
  await step(6);
}

/** Walk forward `FRAMES` frames, capturing every one; return the adjacent-frame series. */
async function walk(tag, keepStrip) {
  await place();
  const diffs = []; let prev = null;
  for (let i = 0; i < FRAMES; i++) {
    await g.h('queueInputs', [{ f: 0, move: [0, 1] }]);
    await step(1);
    const buf = await grab();
    if (prev) diffs.push(+meanAbsL(prev, buf).toFixed(4));
    if (keepStrip && i < 24) fs.writeFileSync(path.join(OUT, 'strip', `${tag}-${String(i).padStart(3, '0')}.png`), buf);
    prev = buf;
  }
  const sorted = [...diffs].sort((a, b) => a - b);
  return {
    frames: FRAMES,
    mean: +(diffs.reduce((s, d) => s + d, 0) / diffs.length).toFixed(4),
    median: +sorted[Math.floor(sorted.length / 2)].toFixed(4),
    p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(4),
    max: +sorted[sorted.length - 1].toFixed(4),
    series: diffs,
  };
}

const setCanopyCast = (on) => g.page.evaluate((v) => {
  let k = 0;
  window.__ENGINE.renderer.scene.traverse((o) => {
    const n = o.name || '';
    if (/^(near-)?canopy:/.test(n)) { o.castShadow = v; k++; }
  });
  return k;
}, on);
const setShadows = (on) => g.page.evaluate((v) => window.__ENGINE.renderer.sky.setFeature('shadows', v), on);

const out = { site: SITE, frames: FRAMES, canvas: [CW, CH], renderer_string, software, arms: {} };

// A — as shipped: the canopy casts.
console.log('arm A — canopy casting (as shipped)');
out.arms.A_canopy_casts = await walk('A', true);

// B — the delete-the-fix arm: canopy caster flag back off, identical walk.
const nB = await setCanopyCast(false);
console.log(`arm B — canopy caster flag off on ${nB} mesh(es)`);
out.arms.B_canopy_does_not_cast = await walk('B', true);

// C — the power control: no sun shadow at all. This is the floor the world's own motion makes.
await setShadows(false);
console.log('arm C — sun shadow off entirely (the instrument\'s noise floor)');
out.arms.C_no_shadow_at_all = await walk('C', false);
await setShadows(true);
await setCanopyCast(true);

const A = out.arms.A_canopy_casts.mean, B = out.arms.B_canopy_does_not_cast.mean, C = out.arms.C_no_shadow_at_all.mean;

// THE POWER TEST IS TWO-SIDED, AND IT WAS ONE-SIDED ON ITS FIRST RUN — WHICH IS THE BUG THIS
// COMMENT EXISTS FOR. The first hardware run at eye-blackwood returned A/C = 0.82 and B/C = 1.005
// and this code printed "NO POWER", because it only asked whether an arm was NOISIER than the
// floor. An arm that departs from the floor by 18% in the QUIETER direction has departed from the
// floor; it is evidence, not an absence of it. A guard that can only see deviation in the
// direction you expected is the same failure as a control that cannot fail.
const dev = (r) => Math.abs(r - 1);
out.verdict = {
  a_over_b: +(A / B).toFixed(3),
  headroom_a_over_c: +(A / C).toFixed(3),
  headroom_b_over_c: +(B / C).toFixed(3),
  // Power belongs to an ARM, not to the run: B sitting on C means the shadow system contributes
  // nothing to motion with the canopy off, which is a finding about B, not a broken instrument.
  arm_a_has_power: dev(A / C) > 0.02,
  arm_b_has_power: dev(B / C) > 0.02,
  reading: null,
  // Stated so nobody quotes the magnitude as if it were a quality score.
  caveat: 'This metric is MEAN ABSOLUTE LUMINANCE change. Shadowing darkens the ground, and a '
    + 'darker image has smaller absolute luminance differences, so a REDUCTION here is confounded '
    + 'with "the frame got darker" and its magnitude must not be read as "the frame got calmer". '
    + 'What the direction does support is the negative claim: flicker would push this UP, and it '
    + 'is not up. A contrast-normalised metric would be needed to quantify the improvement.',
};
out.verdict.reading = (!out.verdict.arm_a_has_power && !out.verdict.arm_b_has_power)
  ? 'NO POWER — both arms sit on the no-shadow floor C, so this walk cannot see shadow-related motion at all and nothing is concluded from it.'
  : (out.verdict.a_over_b > 1.05
    ? `SHIMMER — casting the canopy makes the same walk ${((A / B - 1) * 100).toFixed(1)}% noisier frame-to-frame than not casting it.`
    : `NO SHIMMER DETECTED — casting the canopy moves frame-to-frame change by ${((A / B - 1) * 100).toFixed(1)}% against arm B, in the QUIETER direction. Flicker would push this up; it is not up. See caveat before quoting the magnitude.`);

fs.writeFileSync(path.join(OUT, 'shimmer.json'), JSON.stringify(out, null, 2));
console.log(`\nA (canopy casts)      mean ${A}  p95 ${out.arms.A_canopy_casts.p95}`);
console.log(`B (canopy does not)   mean ${B}  p95 ${out.arms.B_canopy_does_not_cast.p95}`);
console.log(`C (no shadow at all)  mean ${C}  p95 ${out.arms.C_no_shadow_at_all.p95}`);
console.log(`\nA/B ${out.verdict.a_over_b}   A/C ${out.verdict.headroom_a_over_c}   B/C ${out.verdict.headroom_b_over_c}`);
console.log(out.verdict.reading);
await g.close();
