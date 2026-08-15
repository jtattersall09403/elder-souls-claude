#!/usr/bin/env node
/**
 * w1-water-lane-pitch.mjs — WHAT IS THE LANE PITCH, IN METRES, AND WHICH MESH CLASS DRAWS IT?
 *
 * WHY A TOP-DOWN VIEW. Every previous instrument on this defect measured a perspective vista and
 * reported a lane angle in SCREEN degrees. That number cannot be converted into a world pitch:
 * perspective compresses distance non-linearly, so a constant 25 m world lattice appears as a
 * continuously varying screen period, which smears exactly the peak you are trying to find. The
 * `w1-water-lane-terms` crop at `vista-deep-marshes` reports its strongest banding at -46 deg,
 * which is not an axis at all — and when the water is hidden the same crop keeps its structure and
 * merely dims, which is the signature of a pattern that belongs to something else.
 *
 * Looking straight down fixes this. Screen X becomes world X and screen Y becomes world Z, at a
 * constant metres-per-pixel, so an axis-aligned world lattice becomes an axis-aligned SCREEN
 * lattice with a single well-defined period that converts to metres by one multiplication.
 *
 * AND THE SCALE IS MEASURED, NOT DERIVED. It would be easy to compute metres-per-pixel from
 * `PerspectiveCamera(60, ...)` in renderer.js. That is exactly the assumption this project keeps
 * being burned by — renderer.js:1230 re-assigns `camera.fov` from the sim camera every frame, so
 * the constructor value is not necessarily what rendered. Instead `scaleProbe()` projects two
 * world points a known distance apart through the LIVE camera matrices and measures the pixel
 * distance between them. A sibling piece found a "5.5x too fine" UV defect this way — by
 * measuring metres per texel rather than reading the constant.
 *
 * THE ARMS are mesh classes, not shader terms; rounds 1 and 2 already ablated all nine shader
 * terms (including replacing the whole water output with a constant colour) and moved nothing.
 *      nothing ............. floor
 *      shoreline-hidden .... the `water:shoreline:` wet-bank bands
 *      surface-hidden ...... the `water:<region>` water table
 *      water-hidden ........ both, the r1 critic's arm
 *      ground-hidden ....... the terrain, which r1's own data put at rho 0.686
 *
 * Usage:
 *   node tools/visual/w1-water-lane-pitch.mjs --site vista-deep-marshes --height 120 --out <dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { launchGame } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/visual/deck.json'), 'utf8'));
const SITE = String(args.site || 'vista-deep-marshes');
const TIME = Number(args.time || 13);
const HEIGHT = Number(args.height || 120);
const LABEL = String(args.label || 'run');
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/water-lane-pitch/${SITE}-${LABEL}`);
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
// Central crop: the HUD lives in the corners and a HUD edge is a perfect straight line, which is
// precisely the thing this tool is looking for. Keep it out of the analysis window.
const CROP = String(args.crop || '200,760,60,480').split(',').map(Number);

const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));

function lum(buf) {
  const p = PNG.sync.read(buf);
  const y = new Float32Array(p.width * p.height);
  for (let i = 0, j = 0; i < p.data.length; i += 4, j++) y[j] = 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2];
  return { y, w: p.width, h: p.height };
}
/** Mean luminance profile along one screen axis over the crop.
 *  axis 'x' collapses rows -> a profile indexed by screen X (finds lanes running along Z).
 *  axis 'z' collapses columns -> a profile indexed by screen Y (finds lanes running along X). */
function profile(o, [x0, x1, y0, y1], axis) {
  const X1 = Math.min(x1, o.w), Y1 = Math.min(y1, o.h);
  const n = axis === 'x' ? X1 - x0 : Y1 - y0, out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    if (axis === 'x') { for (let y = y0; y < Y1; y++) { s += o.y[y * o.w + (x0 + i)]; c++; } }
    else { for (let x = x0; x < X1; x++) { s += o.y[(y0 + i) * o.w + x]; c++; } }
    out[i] = s / c;
  }
  return out;
}
/** Remove everything slower than the longest period we care about, so a brightness gradient
 *  across the frame cannot masquerade as a very long lane. */
function detrend(p, win) {
  const n = p.length, out = new Float64Array(n), h = Math.max(2, Math.floor(win / 2));
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = -h; k <= h; k++) { const j = i + k; if (j < 0 || j >= n) continue; s += p[j]; c++; }
    out[i] = p[i] - s / c;
  }
  return out;
}
/** Normalised autocorrelation over a lag range, plus the strongest peak. */
function autocorr(p, minLag, maxLag) {
  const n = p.length;
  let m = 0; for (const v of p) m += v; m /= n;
  const d = new Float64Array(n); for (let i = 0; i < n; i++) d[i] = p[i] - m;
  let d0 = 0; for (let i = 0; i < n; i++) d0 += d[i] * d[i];
  const out = [];
  for (let L = minLag; L <= Math.min(maxLag, n - 8); L++) {
    let s = 0; for (let i = 0; i + L < n; i++) s += d[i] * d[i + L];
    out.push({ lag: L, r: d0 > 0 ? s / d0 : 0 });
  }
  // A peak must beat both neighbours, so a monotonic decay is never reported as a period.
  let best = null;
  for (let i = 1; i < out.length - 1; i++) {
    if (out[i].r > out[i - 1].r && out[i].r >= out[i + 1].r && (!best || out[i].r > best.r)) best = out[i];
  }
  return { curve: out, peak: best };
}
function rms(p) { let m = 0; for (const v of p) m += v; m /= p.length; let s = 0; for (const v of p) s += (v - m) * (v - m); return Math.sqrt(s / p.length); }
/** High-pass returned as a rectangle, for `lanes()`. */
function hpRect(o, [x0, x1, y0, y1]) {
  const X1 = Math.min(x1, o.w), Y1 = Math.min(y1, o.h);
  const w = X1 - x0, hh = Y1 - y0, out = new Float32Array(w * hh);
  for (let y = y0; y < Y1; y++) for (let x = x0; x < X1; x++) {
    let s = 0, c = 0;
    for (let k = -4; k <= 4; k++) { const yy = y + k; if (yy < 0 || yy >= o.h) continue; s += o.y[yy * o.w + x]; c++; }
    out[(y - y0) * w + (x - x0)] = o.y[y * o.w + x] - s / c;
  }
  return { h: out, w, hh };
}
/** Directional banding. Projects the high-passed crop onto an axis at each angle; parallel lanes
 *  concentrate their variance at the one angle perpendicular to them. Top-down, so the reported
 *  angle is a WORLD bearing about Y, not a screen artefact of perspective. */
function lanes(h, w, hh) {
  const at = (x, y) => h[y * w + x];
  const stats = [];
  for (let deg = -90; deg < 90; deg += 2) {
    const th = deg * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th);
    const off = Math.min(0, ux * (w - 1)) + Math.min(0, uy * (hh - 1));
    const nb = Math.ceil(Math.abs(ux) * w + Math.abs(uy) * hh) + 2;
    const acc = new Float64Array(nb), cnt = new Float64Array(nb);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const t = Math.round(ux * x + uy * y - off); if (t < 0 || t >= nb) continue; acc[t] += at(x, y); cnt[t]++; }
    const need = Math.max(8, 0.25 * Math.min(w, hh));
    const prof = []; for (let i = 0; i < nb; i++) if (cnt[i] >= need) prof.push(acc[i] / cnt[i]);
    if (prof.length < 8) continue;
    let m = 0; for (const v of prof) m += v; m /= prof.length;
    let va = 0; for (const v of prof) va += (v - m) * (v - m); va /= prof.length;
    stats.push({ deg, va });
  }
  if (!stats.length) return { lane_power: 0, lane_angle: null, lane_aniso: 1 };
  const sorted = stats.slice().sort((a, b) => b.va - a.va);
  const med = stats.slice().sort((a, b) => a.va - b.va)[Math.floor(stats.length / 2)].va;
  return { lane_power: +sorted[0].va.toFixed(3), lane_angle: sorted[0].deg, lane_aniso: +(sorted[0].va / Math.max(1e-6, med)).toFixed(2) };
}

const g = await launchGame({ entry: 'game/index.html', width: CW, height: CH });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  const r = window.__ENGINE.renderer;
  if (r.renderer && r.renderer.setPixelRatio) r.renderer.setPixelRatio(1);
  r.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', SEED);
const step = (n) => g.h('stepFrames', n);
const s = DECK.setups.find((x) => x.id === SITE);
if (!s) { console.error(`no Deck setup '${SITE}'`); await g.close(); process.exit(2); }
await g.h('teleport', s.place.x, s.place.z);
await step(40);
const snap = await g.h('snapshot');
const [px, py, pz] = snap.player.pos;
// Straight down. The look target is nudged by 1 mm in +Z so the view direction is not exactly
// antiparallel to the default up vector, which would make the camera basis degenerate.
await g.h('camera', { pos: [px, py + HEIGHT, pz], look: [px, py, pz + 0.001] });
await g.h('setWeather', 'clear');
await g.h('setTimeOfDay', TIME);
await step(20);

/** Metres per pixel, measured through the LIVE camera rather than derived from its constructor. */
const scaleProbe = () => g.page.evaluate(({ px, py, pz, CW, CH }) => {
  const R = window.__ENGINE.renderer, cam = R.camera;
  cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  const T = window.__ENGINE.renderer.constructor;
  const proj = (x, y, z) => {
    const v = new (Object.getPrototypeOf(cam.position).constructor)(x, y, z);
    v.project(cam);
    return [(v.x * 0.5 + 0.5) * CW, (-v.y * 0.5 + 0.5) * CH];
  };
  const D = 50;
  const a = proj(px, py, pz), bx = proj(px + D, py, pz), bz = proj(px, py, pz + D);
  const dx = Math.hypot(bx[0] - a[0], bx[1] - a[1]), dz = Math.hypot(bz[0] - a[0], bz[1] - a[1]);
  return { fov: cam.fov, aspect: cam.aspect, camPos: cam.position.toArray().map((v) => +v.toFixed(2)),
    px_per_m_worldX: +(dx / D).toFixed(4), px_per_m_worldZ: +(dz / D).toFixed(4),
    screen_of_origin: a.map((v) => +v.toFixed(1)),
    screen_of_plusX: bx.map((v) => +v.toFixed(1)), screen_of_plusZ: bz.map((v) => +v.toFixed(1)) };
}, { px, py, pz, CW, CH });

const hideClass = (include, exclude) => g.page.evaluate(({ include, exclude }) => {
  const R = window.__ENGINE.renderer, inc = new RegExp(include), exc = exclude ? new RegExp(exclude) : null;
  window.__PITCH_HIDDEN = []; let hidden = 0;
  R.scene.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh) || !o.visible) return;
    const n = o.name || '';
    if (!inc.test(n) || (exc && exc.test(n))) return;
    window.__PITCH_HIDDEN.push(o); o.visible = false; hidden++;
  });
  return { hidden };
}, { include, exclude: exclude || null });
const unhide = () => g.page.evaluate(() => { for (const o of (window.__PITCH_HIDDEN || [])) o.visible = true; window.__PITCH_HIDDEN = []; });

async function shot(name) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(OUT, 'frames', `${name}.png`), buf);
  return buf;
}

const scale = await scaleProbe();
const MPP_X = 1 / scale.px_per_m_worldX, MPP_Z = 1 / scale.px_per_m_worldZ;

/* --- shader-term editing, carried over from w1-water-lane-terms.mjs ---------------------------
 * Rounds 1 and 2 ran these same arms and found nothing. They ran them through a PERSPECTIVE crop
 * at `vista-deep-marshes` whose dominant structure is a terrain weave at -46 screen degrees — a
 * pattern that survives hiding the water and merely dims. So those negative results were never a
 * test of the lanes: the crop did not contain the signal. Re-running them top-down, where the
 * lanes are plainly visible, is the whole point of this tool.
 * Every arm asserts its own substitution count; an arm that matched nothing is VACUOUS and is
 * never read as a negative result (RULES rule 6, the inert control). */
const applyEdits = (armId, edits) => g.page.evaluate(({ armId, edits }) => {
  const R = window.__ENGINE.renderer;
  const mats = new Set();
  R.scene.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) if (m && m.userData && m.userData.waterUniforms) mats.add(m);
  });
  for (const m of mats) {
    if (!m.__pitchOrigOBC) { m.__pitchOrigOBC = m.onBeforeCompile; m.__pitchOrigKey = m.customProgramCacheKey; }
    m.onBeforeCompile = function (shader, renderer) {
      m.__pitchOrigOBC.call(this, shader, renderer);
      for (const [needle, rep, where] of edits) {
        const t = (where === 'vertex') ? 'vertexShader' : 'fragmentShader';
        if (shader[t].includes(needle)) { shader[t] = shader[t].split(needle).join(rep); window.__PITCH_EDITS++; }
      }
    };
    m.customProgramCacheKey = () => `w1-water-lane-pitch:${armId}`;
    m.needsUpdate = true;
  }
  window.__PITCH_EDITS = 0; window.__PITCH_MATS = mats;
  return { materials: mats.size };
}, { armId, edits });
const editCount = () => g.page.evaluate(() => window.__PITCH_EDITS || 0);
const restoreEdits = () => g.page.evaluate(() => {
  for (const m of (window.__PITCH_MATS || [])) {
    if (m.__pitchOrigOBC) { m.onBeforeCompile = m.__pitchOrigOBC; m.customProgramCacheKey = m.__pitchOrigKey; m.needsUpdate = true; }
  }
  window.__PITCH_MATS = new Set();
});
const E = (needle, rep, where) => [needle, rep, where || 'fragment'];

const ARMS = [
  { id: 'baseline', include: '^__none__', exclude: null, what: 'untouched' },
  // ---- mesh classes -------------------------------------------------------------------------
  { id: 'shoreline-hidden', include: '^water:shoreline:', exclude: null, what: 'the wet-bank deposit bands only' },
  { id: 'surface-hidden', include: '^water', exclude: '^water:shoreline:', what: 'the water table only' },
  { id: 'water-hidden', include: '^water', exclude: null, what: 'both water classes — the r1 critic arm' },
  // ---- the wave field, term by term, now that the view contains the signal ---------------------
  // Each `es*` phase is a plane wave; its period along an axis is 2*pi/|k| on that axis. esA is
  // 27.3 m in X and 37.0 m in Z, which is the scale of the bands visible in the top-down frame.
  { id: 'term-vertexwave-zero', what: 'vEsWaterWave -> 0: the summed crossed-wave field driving the vertex lift AND the 0.8% diffuse modulation',
    edits: [E('vEsWaterWave=sin(esA)*.48+sin(esB)*.36+sin(esC)*.16;', 'vEsWaterWave=0.0;', 'vertex')] },
  { id: 'term-diffuse-modulation-zero', what: 'the diffuse modulation ONLY: the wave field still lifts the vertices but no longer tints the colour',
    edits: [E('diffuseColor.rgb*=1.015+vEsWaterWave*.008;', 'diffuseColor.rgb*=1.015;')] },
  { id: 'term-slope-zero', what: 'esSlope -> 0: the crossed-wave normal perturbation feeding Fresnel and both reflection lookups',
    edits: [E('normal=normalize(normal+vec3(esSlope.x,0.0,esSlope.y));', 'normal=normalize(normal);')] },
  { id: 'term-slope-A-only-zero', what: 'the esA component of esSlope alone -> 0, isolating the longest of the three crossed waves',
    edits: [E('vec2 esSlope=vec2(cos(esA)*.030-cos(esB)*.019+cos(esC)*.012+cos(esD)*.010,\n                          cos(esA)*.022+cos(esB)*.031-cos(esC)*.010+cos(esD)*.007);',
      'vec2 esSlope=vec2(-cos(esB)*.019+cos(esC)*.012+cos(esD)*.010,\n                          cos(esB)*.031-cos(esC)*.010+cos(esD)*.007);')] },
  { id: 'term-reflection-uv-warp-zero', what: 'the esSlope warp of BOTH reflection lookups removed, leaving the reflection unwarped',
    edits: [E('esReflUV+=esSlope*.0015;', ''), E('texture2D(uWaterReflection,esScreenUV+esSlope*.0025)', 'texture2D(uWaterReflection,esScreenUV)')] },
  { id: 'term-fine-additive-zero', what: 'the caustic/shimmer/pulse/ripple/capillary/micro additive line -> nothing',
    edits: [E('outgoingLight+=vec3(.006,.010,.011)*esCaustic', 'outgoingLight+=0.0*vec3(.006,.010,.011)*esCaustic')] },
  // ---- the plausible-wrong-answer null control ------------------------------------------------
  // NOT "hide the water" — that is the diagnosis and it is a mesh arm above. This changes what the
  // water LOOKS like (depth colour, and every wave AMPLITUDE halved) without touching the
  // wave GEOMETRY that sets the lane directions and periods. It MUST NOT remove the lanes.
  { id: 'null-recolour-and-amplitude', kind: 'null-control',
    what: 'depth colour changed and every slope amplitude halved — a visible change to the water that leaves the wave geometry alone; MUST NOT fix the lanes',
    edits: [
      E('vec3 esDepth=vec3(.038,.105,.118)+diffuseColor.rgb*.21;', 'vec3 esDepth=vec3(.140,.070,.055)+diffuseColor.rgb*.21;'),
      E('vec2 esSlope=vec2(cos(esA)*.030-cos(esB)*.019+cos(esC)*.012+cos(esD)*.010,\n                          cos(esA)*.022+cos(esB)*.031-cos(esC)*.010+cos(esD)*.007);',
        'vec2 esSlope=vec2(cos(esA)*.015-cos(esB)*.0095+cos(esC)*.006+cos(esD)*.005,\n                          cos(esA)*.011+cos(esB)*.0155-cos(esC)*.005+cos(esD)*.0035);'),
    ] },
  // ---- the two remaining routes into a water pixel ---------------------------------------------
  // Round 2's `flat-water` arm substituted at `outgoingLight=mix(outgoingLight,esSurface,.68)`,
  // but SIX further statements modify outgoingLight after that line — the fine additive row, the
  // shore mix and the foam add — so that arm never actually produced a constant colour. This one
  // overrides at the last statement before `#include <opaque_fragment>`, so the water's outgoing
  // light really is one constant while its geometry, alpha and draw order are untouched.
  { id: 'term-truly-flat-water', what: 'the water fragment output forced to ONE constant colour at the very last statement, alpha and geometry untouched. If the lanes survive this they are not in the water fragment colour at all',
    edits: [E('outgoingLight+=vec3(.095,.105,.082)*esFoam;', 'outgoingLight+=vec3(.095,.105,.082)*esFoam;outgoingLight=vec3(.28,.36,.35);')] },
  // The water is `transparent:true, opacity 0.828, depthWrite:false`. If the colour is innocent,
  // what varies per pixel may be how much of the bed shows THROUGH the water, or how many
  // transparent water layers blend at that pixel. Forcing alpha to 1 removes both at once.
  { id: 'term-alpha-opaque', what: 'diffuseColor.a forced to 1.0: the water stops being see-through, so neither the bed beneath nor a second blended water layer can reach the pixel',
    edits: [E('outgoingLight+=vec3(.095,.105,.082)*esFoam;', 'outgoingLight+=vec3(.095,.105,.082)*esFoam;diffuseColor.a=1.0;')] },
  // ---- the composition, not the wave field -----------------------------------------------------
  // Every wave term above is innocent while forcing the whole output constant is not, so what
  // remains is WHAT IS BEING MIXED rather than how it is modulated. esSurface is 61% reflection
  // and the final line is 68% esSurface, so the reflection render target is ~41% of a water pixel.
  { id: 'term-no-reflection', what: 'esSurface = esDepth: the planar/screen reflection texture contributes nothing, the depth colour and all wave terms stay',
    edits: [E('vec3 esSurface=mix(esDepth,esReflection,(.25+esGrazing*.50)*uWaterReflectionStrength);', 'vec3 esSurface=esDepth;')] },
  { id: 'term-no-standard-lighting', what: 'the final mix weight to 1.0, discarding the 32% of three.js standard lighting that reaches the water pixel',
    edits: [E('outgoingLight=mix(outgoingLight,esSurface,.68);', 'outgoingLight=esSurface;')] },
  // ---- the shadow arm, re-run through a crop that can actually see the lanes -------------------
  // The r1 critic ruled shadows out, but did so through the perspective crop whose dominant
  // structure survives hiding the water entirely. That crop cannot carry the conclusion, so the
  // arm is re-run here. `sky.features.shadows` is consumed inside Sky.apply() on every render, and
  // the report is read AFTER the settle step, because read before any render it returns the
  // previous frame's value and an inert arm looks exactly like a live one.
  { id: 'shadows-off', kind: 'cross-check', feature: 'shadows',
    what: 'every shadow off. If the -50 deg anisotropy is the sun casting tree shadows across the water, this is the arm that removes it' },
  // ---- the screen-space half of the reflection --------------------------------------------------
  // `esScreenUV = gl_FragCoord.xy / uWaterReflectionResolution` indexes the reflection target by
  // SCREEN position, and `esReflection=mix(esReflection,esScreenReflection,.62)` makes that lookup
  // 62% of the reflection — about 41% of a water pixel. A screen-indexed sample is pinned to the
  // viewport rather than to the world, so whatever the reflection target contains is painted onto
  // the water in screen space. That is why the streaks in the top-down frame radiate from the
  // centre of the IMAGE rather than running along a world bearing, and it is the one property no
  // wave-term ablation could touch: the waves only nudge this lookup by 0.0025 of a UV.
  { id: 'term-no-screenspace-reflection', what: 'the screen-space reflection blend removed, leaving the world-projected planar reflection alone',
    edits: [E('esReflection=mix(esReflection,esScreenReflection,.62);', '')] },
  { id: 'term-screenspace-only', what: 'the complement: the blend forced to 1.0 so the reflection is ENTIRELY the screen-space lookup. If the screen term owns the lanes this must make them worse',
    edits: [E('esReflection=mix(esReflection,esScreenReflection,.62);', 'esReflection=esScreenReflection;')] },
  { id: 'nothing-restore-control', include: '^__none__', exclude: null, what: 'floor' },
];
const setFeature = (n, o) => g.page.evaluate(({ n, o }) => window.__ENGINE.renderer.sky.setFeature(n, o), { n, o });
const shadowReport = () => g.page.evaluate(() => {
  const sky = window.__ENGINE.renderer.sky;
  return { castShadow: sky.sun.castShadow, feature: sky.features.shadows, intensity: +sky.sun.intensity.toFixed(3) };
});

/* Each arm forces a full recompile of every water program plus a full-frame readback, and the
 * headless GPU process here dies after roughly four of them. `--only` runs a named subset in one
 * browser; `baseline` and the floor are never dropped because no other row can be read without
 * them. The batches are independent runs against the same pinned revision, not one run split. */
const ONLY = args.only ? String(args.only).split(',') : null;
// `surface-hidden` rides in every batch as the POSITIVE CONTROL. RULES rule 6: a control you have
// never seen fail is a second copy of the experiment, so each batch must independently show its
// metric going red before any negative row in that batch may be believed.
const SELECTED = ONLY ? ARMS.filter((a) => ONLY.includes(a.id) || a.id === 'baseline' || a.id === 'surface-hidden' || a.id === 'nothing-restore-control') : ARMS;

const out = { tool: 'w1-water-lane-pitch', site: SITE, time: TIME, height_m: HEIGHT, label: LABEL,
  only: ONLY,
  canvas: [CW, CH], crop: CROP, seed: SEED, commit: null, scale,
  metres_per_pixel: { worldX: +MPP_X.toFixed(4), worldZ: +MPP_Z.toFixed(4) }, arms: [], checks: {}, pageErrors: [] };
try { out.commit = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim(); } catch {}
console.log(`commit ${out.commit}  site ${SITE}  top-down from ${HEIGHT} m  t${TIME}`);
console.log(`scale (measured through the live camera): ${JSON.stringify(scale)}`);
console.log(`metres per pixel: X ${MPP_X.toFixed(4)}  Z ${MPP_Z.toFixed(4)}`);

// Lags to search: 4 px up to a third of the crop. Reported in metres via the measured scale.
for (const arm of SELECTED) {
  let applied = { hidden: 0 };
  if (arm.edits) applied = await applyEdits(arm.id, arm.edits);
  else if (arm.feature) { await setFeature(arm.feature, false); await step(4); applied = { feature: `${arm.feature}=false`, shadow_report_after_step: await shadowReport() }; }
  else applied = await hideClass(arm.include, arm.exclude);
  await step(4);
  const buf = await shot(arm.id);
  if (arm.edits) applied.edits_applied = await editCount();
  const L = lum(buf);
  const row = { arm: arm.id, kind: arm.kind || (arm.edits ? 'term' : 'mesh-class'), what: arm.what,
    applied, meshes_hidden: applied.hidden || 0,
    vacuous: !!(arm.edits && !applied.edits_applied) };
  // Directional lane metric: top-down, so screen degrees ARE world degrees about the Y axis.
  { const r = hpRect(L, CROP); Object.assign(row, lanes(r.h, r.w, r.hh)); }
  for (const [axis, mpp] of [['x', MPP_X], ['z', MPP_Z]]) {
    const p = profile(L, CROP, axis);
    const d = detrend(p, Math.round(60 / mpp)); // flatten anything slower than ~60 m
    const { peak } = autocorr(d, Math.max(4, Math.round(3 / mpp)), Math.round(45 / mpp));
    row[`${axis}_rms`] = +rms(d).toFixed(3);
    row[`${axis}_peak_lag_px`] = peak ? peak.lag : null;
    row[`${axis}_peak_period_m`] = peak ? +(peak.lag * mpp).toFixed(2) : null;
    row[`${axis}_peak_r`] = peak ? +peak.r.toFixed(3) : null;
  }
  out.arms.push(row);
  // Written after EVERY arm, not at the end. The headless GPU process here dies after roughly four
  // recompile+readback cycles, and a run that loses all of its rows to the last one is a run that
  // has to be paid for twice.
  fs.writeFileSync(path.join(OUT, 'lane-pitch.json'), JSON.stringify(out, null, 2));
  const tag = row.vacuous ? 'VACUOUS — substitution matched nothing' : (arm.edits ? `edits ${applied.edits_applied}` : `hid ${applied.hidden}`);
  console.log(`  ${arm.id.padEnd(30)} X rms ${String(row.x_rms).padStart(6)} (${String(row.x_peak_period_m).padStart(6)} m)  Z rms ${String(row.z_rms).padStart(6)} (${String(row.z_peak_period_m).padStart(6)} m)  lane_power ${String(row.lane_power).padStart(8)} aniso ${String(row.lane_aniso).padStart(6)} @${String(row.lane_angle).padStart(4)}deg  ${tag}`);
  if (arm.edits) await restoreEdits(); else if (arm.feature) await setFeature(arm.feature, true); else await unhide();
  await step(4);
}
const byId = Object.fromEntries(out.arms.map((a) => [a.arm, a]));
const base = byId['baseline'], floor = byId['nothing-restore-control'], pos = byId['surface-hidden'];
out.checks['FLOOR-IS-STABLE'] = (Math.abs(floor.x_rms - base.x_rms) / Math.max(1e-6, base.x_rms) < 0.25)
  ? `PASS — floor rms ${floor.x_rms} against baseline ${base.x_rms}; the site is reproducible enough to read the arms`
  : `FAIL — floor rms ${floor.x_rms} against baseline ${base.x_rms}; the scene is not self-similar and no arm below is readable`;
// The positive control. Hiding the water table is known to remove the lanes; if it does not go red
// on THIS metric, the metric cannot see them and no term row below means anything.
out.checks['METRIC-CAN-SEE-LANES'] = (pos && pos.x_rms < floor.x_rms * 0.5)
  ? `PASS — hiding the water table drops profile rms ${floor.x_rms} -> ${pos.x_rms} (${Math.round(100 - 100 * pos.x_rms / floor.x_rms)}%), so this metric can go red`
  : `FAIL — hiding the water table left rms at ${pos && pos.x_rms} against floor ${floor.x_rms}; no row below is readable`;
out.checks['NO-ARM-IS-VACUOUS'] = out.arms.filter((a) => a.vacuous).length === 0
  ? 'PASS — every shader arm landed at least one substitution'
  : `FAIL — vacuous arms: ${out.arms.filter((a) => a.vacuous).map((a) => a.arm).join(', ')}`;
// Two-sided classification against the floor (HAZARDS 0b: a one-sided guard is blind on half the
// number line, and an arm that makes the banding WORSE is as much a finding as one that fixes it).
const FX = floor.x_rms, FL = floor.lane_power, FA = floor.lane_aniso;
out.arms.forEach((a) => {
  if (a.vacuous) { a.verdict = 'VACUOUS'; return; }
  a.x_rms_vs_floor_pct = +(100 * (a.x_rms - FX) / Math.max(1e-6, FX)).toFixed(1);
  a.lane_power_vs_floor_pct = +(100 * (a.lane_power - FL) / Math.max(1e-6, FL)).toFixed(1);
  a.lane_aniso_vs_floor_pct = +(100 * (a.lane_aniso - FA) / Math.max(1e-6, FA)).toFixed(1);
  a.verdict = a.x_rms_vs_floor_pct < -50 ? 'REMOVES THE LANES'
    : a.x_rms_vs_floor_pct < -25 ? 'materially weakens the lanes'
      : a.x_rms_vs_floor_pct > 25 ? 'MAKES THE LANES WORSE' : 'no effect on the lanes';
});
const nul = byId['null-recolour-and-amplitude'];
out.checks['NULL-CONTROL-MUST-NOT-FIX'] = !nul ? 'FAIL — null control did not run'
  : nul.vacuous ? 'FAIL — null control matched nothing (vacuous)'
    : (nul.x_rms_vs_floor_pct > -25
      ? `PASS — the null control changed the water's colour and halved its slope amplitudes and the lanes stayed (rms ${nul.x_rms} against floor ${FX})`
      : `FAIL — the null control ALSO removed the lanes (rms ${nul.x_rms} against floor ${FX}); it is not a wrong answer and cannot discriminate`);
out.pageErrors = g.errors.slice(0, 20);
fs.writeFileSync(path.join(OUT, 'lane-pitch.json'), JSON.stringify(out, null, 2));
console.log('');
for (const [k, v] of Object.entries(out.checks)) console.log(`${k}: ${v}`);
console.log(`\nwrote ${path.join(OUT, 'lane-pitch.json')}`);
await g.close();
