#!/usr/bin/env node
/**
 * w1-30-canopy-shimmer.mjs — does the canopy's new shadow SHIMMER when the camera moves?
 *
 * WRITTEN BY THE CRITIC OF W1-30-SHADOW-CASTERS. It is the measurement that piece names as its
 * own biggest gap: *"NO MOTION EVIDENCE OF MY OWN… nobody has yet watched a walk with the canopy
 * casting, which is where sub-texel shimmer and a crawling shadow-volume edge would show up and a
 * still never can."* It is also R5's written tripwire — `under`, `rock` and `cover` are declined
 * because *"a grass blade is sub-texel in a 4096 map fitted to 150 m… WHAT WOULD OVERTURN IT: a
 * motion sequence showing they are stable."*
 *
 * WHY A DIFF BETWEEN CONSECUTIVE FRAMES IS THE WRONG STATISTIC, and this tool does not use one.
 * Everything in a forest frame moves: the foliage animates, the camera translates, and a shadow
 * that MOVES SMOOTHLY across the ground is the feature, not the defect. An arm-to-arm or
 * frame-to-frame pixel diff scores all three the same, which is exactly the trap W1-30-SHADOW-
 * CASTERS recorded as F7 ("77.6% of pixels changed … side by side they are the same picture").
 *
 * WHAT SHIMMER ACTUALLY IS: a pixel whose luminance OSCILLATES — up, down, up — as the shadow
 * texel it samples flips across the depth comparison. Smooth motion crosses a pixel once. So the
 * statistic is the ZERO-CROSSING RATE of each pixel's luminance time series over the sequence,
 * counted only where the swing exceeds a threshold that a smooth ramp would not produce.
 * `flicker_rate` = mean oscillations per pixel per 10 frames.
 *
 * THREE ARMS, AND THE THIRD ONE IS A POSITIVE CONTROL THAT MUST GO RED (RULES 4/6).
 *
 *   A  canopy-off      the state before this round: `canopy:*` and `near-canopy:*` do not cast.
 *   B  canopy-on       the shipped state at HEAD.
 *   C  canopy+under    B plus the `under` and `rock` buckets — the set R5 DECLINED as sub-texel
 *                      shimmer risk. If C does not read higher than B, this instrument cannot see
 *                      shimmer and its verdict on B is worthless. That is stated, not assumed.
 *
 * Every arm walks the SAME path with the SAME seed through the REAL input pipeline (`queueInputs`
 * → ACTIONS), so the foliage animation and the camera track are identical between arms by
 * construction and the only difference is which meshes entered the shadow atlas.
 *
 * HAZARDS §0'S FIFTH FAILURE SHAPE — which input do all three arms supply identically? The walk
 * itself: the same frame-indexed input script. That is deliberate and it is the control, not the
 * flaw — three different walks could not be compared at all. What no arm fabricates is the thing
 * in dispute: each arm reads its own caster census off the scene graph after flipping the flags,
 * and an arm that flipped nothing reports `flagged: 0` and is visible as a duplicate rather than
 * silently passing as a second copy of its neighbour.
 *
 * Usage:
 *   node tools/visual/w1-30-canopy-shimmer.mjs --site eye-blackwood --frames 90
 *   node tools/visual/w1-30-canopy-shimmer.mjs --hardware --canvas 1280x720 --frames 120
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
const TAG = String(args.tag || 'shimmer');
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/canopy-shimmer/${TAG}`);
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '640x360').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
const SITE = String(args.site || 'eye-blackwood');
const FRAMES = Number(args.frames || 60);
const TIME = Number(args.time || 13);
const HW = args.hardware === true || process.env.VT_HARDWARE_GPU === '1';
const KEEP = args.keepFrames === true;

const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));

// The buckets, by the mesh names `province.js` gives them. Kept as strings so a rename shows up
// as an empty arm rather than as a silent zero.
const CANOPY = ['canopy:', 'near-canopy:'];
const UNDER = ['under:', 'near-under:', 'rock:', 'near-rock:'];

const g = await launchGame({ entry: 'game/index.html', width: CW, height: CH, hardwareGpu: HW });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  const r = window.__ENGINE.renderer;
  if (r.renderer && r.renderer.setPixelRatio) r.renderer.setPixelRatio(1);
  r.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', SEED);

const renderer_string = await g.page.evaluate(() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'none'));
  } catch (e) { return `unavailable: ${e.message}`; }
});
const software = /swiftshader|llvmpipe|software|mesa/i.test(renderer_string) || /^unavailable/i.test(renderer_string);
console.log(`renderer: ${renderer_string}${software ? '  *** SOFTWARE ***' : ''}`);

const step = (n) => g.h('stepFrames', n);

/** Put the player at the site and stand still for a moment so streaming settles. */
async function goTo(site) {
  const s = DECK.setups.find((x) => x.id === site);
  if (!s) throw new Error(`no Deck setup '${site}'`);
  await g.h('teleport', s.place.x, s.place.z);
  await step(60);
  await g.h('setWeather', 'clear');
  await g.h('setTimeOfDay', TIME);
  await step(20);
  return s;
}

/**
 * Set the caster flags for one arm, ABSOLUTELY rather than additively. The builder's own tool only
 * ever turns flags ON, which is why its `base` arm stopped being a baseline the moment the flags
 * landed in source and two of its six arms became duplicates of their neighbours. This one writes
 * the value it wants and reports how many meshes it actually changed.
 */
const setCasters = (prefixes, on) => g.page.evaluate(({ prefixes, on }) => {
  const R = window.__ENGINE.renderer;
  let changed = 0, matched = 0;
  R.scene.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh)) return;
    const n = o.name || '';
    if (!prefixes.some((p) => n.startsWith(p))) return;
    matched++;
    if (o.castShadow !== on) { o.castShadow = on; changed++; }
  });
  return { matched, changed };
}, { prefixes, on });

const shadowLoad = () => g.page.evaluate(() => {
  const R = window.__ENGINE.renderer;
  let meshes = 0, tris = 0;
  R.scene.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh) || !o.castShadow || !o.visible) return;
    const geo = o.geometry; if (!geo) return;
    const idx = geo.index ? geo.index.count : (geo.attributes.position ? geo.attributes.position.count : 0);
    meshes++; tris += (idx / 3) * (o.isInstancedMesh ? o.count : 1);
  });
  return { casterMeshes: meshes, casterTriangles: Math.round(tris) };
});

/** Walk forward, capturing every frame. Real input pipeline, frame-indexed, identical per arm. */
async function walk(arm) {
  const inputs = [{ f: 0, move: [0, 1] }];
  // A slow yaw as well as translation: a shadow-volume edge crawls when the FIT moves, and the
  // fit follows the camera's direction as much as its position.
  for (let f = 0; f <= FRAMES; f++) inputs.push({ f, look: f < FRAMES ? [0.8, 0] : [0, 0] });
  await g.h('queueInputs', inputs);
  const lum = [];
  for (let f = 0; f < FRAMES; f++) {
    await step(1);
    const d = await g.h('screenshot');
    const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
    if (KEEP || f % 12 === 0) fs.writeFileSync(path.join(OUT, 'frames', `${arm}-f${String(f).padStart(4, '0')}.png`), buf);
    const p = PNG.sync.read(buf);
    const n = p.width * p.height;
    const y = new Float32Array(n);
    for (let i = 0, j = 0; i < p.data.length; i += 4, j++) {
      y[j] = 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2];
    }
    lum.push(y);
  }
  await g.h('queueInputs', [{ f: 0, move: [0, 0], look: [0, 0] }]);
  await step(2);
  return lum;
}

/**
 * Oscillations per pixel per 10 frames, counted only on swings above `amp`. A smooth ramp — a
 * shadow edge sweeping across the pixel — contributes ZERO crossings; a texel flip contributes one
 * per reversal. `amp` is in 0-255 luminance and is deliberately well above PNG quantisation.
 */
function flickerRate(lum, amp = 8) {
  if (lum.length < 3) return null;
  const n = lum[0].length;
  let crossings = 0, movedPixels = 0;
  for (let p = 0; p < n; p++) {
    let last = lum[0][p], dir = 0, c = 0, moved = false;
    for (let f = 1; f < lum.length; f++) {
      const v = lum[f][p], d = v - last;
      if (Math.abs(d) < amp) continue;
      moved = true;
      const s = d > 0 ? 1 : -1;
      if (dir !== 0 && s !== dir) c++;
      dir = s; last = v;
    }
    crossings += c;
    if (moved) movedPixels++;
  }
  return {
    flicker_per_px_per_10f: +((crossings / n) * (10 / (lum.length - 1))).toFixed(4),
    moved_px_frac: +(movedPixels / n).toFixed(4),
    total_crossings: crossings,
  };
}

const out = { tag: TAG, site: SITE, frames: FRAMES, canvas: [CW, CH], seed: SEED, time: TIME,
  renderer_string, software, arms: [], pageErrors: [] };

const setup = await goTo(SITE);
out.place = setup.place;

const ARMS = [
  { id: 'A-canopy-off', apply: async () => [await setCasters(CANOPY, false), await setCasters(UNDER, false)] },
  { id: 'B-canopy-on', apply: async () => [await setCasters(CANOPY, true), await setCasters(UNDER, false)] },
  { id: 'C-canopy+under', apply: async () => [await setCasters(CANOPY, true), await setCasters(UNDER, true)] },
];

const start = await g.h('snapshot');
const startPos = start.player.pos.slice();

for (const arm of ARMS) {
  // Every arm starts from the same body pose and the same place, or the walks are not comparable.
  await g.h('teleport', setup.place.x, setup.place.z);
  await step(40);
  await g.h('setTimeOfDay', TIME);
  await step(10);
  const flagged = await arm.apply();
  const load = await shadowLoad();
  await step(4);
  const lum = await walk(arm.id);
  const flick = flickerRate(lum);
  const row = { arm: arm.id, flagged, ...load, ...flick };
  out.arms.push(row);
  console.log(`  ${arm.id.padEnd(16)} casters ${String(load.casterMeshes).padStart(5)} / ${String(load.casterTriangles).padStart(9)} tris   flicker ${row.flicker_per_px_per_10f}   moved ${(row.moved_px_frac * 100).toFixed(1)}%   flags ${JSON.stringify(flagged)}`);
}

const A = out.arms.find((r) => r.arm === 'A-canopy-off');
const B = out.arms.find((r) => r.arm === 'B-canopy-on');
const C = out.arms.find((r) => r.arm === 'C-canopy+under');
out.checks = [
  { id: 'ARMS-ARE-DISTINCT', ok: A.casterTriangles < B.casterTriangles && B.casterTriangles < C.casterTriangles,
    detail: `${A.casterTriangles} < ${B.casterTriangles} < ${C.casterTriangles} shadow-pass triangles` },
  { id: 'INSTRUMENT-CAN-SEE-SHIMMER', ok: C.flicker_per_px_per_10f > B.flicker_per_px_per_10f,
    detail: `the declined sub-texel set reads ${C.flicker_per_px_per_10f} against the shipped ${B.flicker_per_px_per_10f}; if this is not higher the instrument is blind and B's result means nothing` },
  { id: 'CANOPY-DOES-NOT-SHIMMER', ok: B.flicker_per_px_per_10f <= A.flicker_per_px_per_10f * 1.25,
    detail: `canopy-on ${B.flicker_per_px_per_10f} against canopy-off ${A.flicker_per_px_per_10f} (allowance 25%)` },
];
out.pageErrors = g.errors.slice(0, 20);
fs.writeFileSync(path.join(OUT, 'canopy-shimmer.json'), JSON.stringify(out, null, 2));
for (const c of out.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id} — ${c.detail}`);
console.log(`\nwrote ${path.join(OUT, 'canopy-shimmer.json')}`);
await g.close();
