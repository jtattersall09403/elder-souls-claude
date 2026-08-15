#!/usr/bin/env node
/**
 * f7-critic-look.mjs — F7 CRITIC. LOOK AT THE WATER, FROM MANY ANGLES, IN MOTION, ON BOTH ARMS.
 *
 * The builder's case for F7 is one scalar (banding rms 7.711 -> 5.484) from ONE pose (straight
 * down at 120 m) at ONE site. CLAUDE.md's standing directive is that a still from one angle is
 * exactly how a defect got declared fixed while it was still broken. This tool produces the
 * pictures a verdict is allowed to rest on, plus three measurements the builder did not make:
 *
 *   1. MANY ANGLES. Top-down, two intermediate pitches, the deck vista pose, three eye-level
 *      yaws, and a near-grazing pose. Water read only from directly above is water nobody plays.
 *   2. MOTION. A stationary sequence (the water animating under a fixed camera) and a DOLLY.
 *      The dolly matters because renderer.js:1424 gates the reflection reprojection on 0.24 m of
 *      camera movement or 6 frames, so a moving camera is the only condition under which that
 *      staleness can be photographed at all.
 *   3. IS THE BANDING A WORLD BEARING, OR A SCREEN-SPACE STARBURST? The builder fits ONE angle
 *      over the whole crop and calls it a world bearing of -50 deg. A radial screen-space pattern
 *      also yields one dominant angle when you fit one to it, and it is a different defect with a
 *      different remedy. So orientation is measured with a STRUCTURE TENSOR — a different
 *      estimator from the builder's projection-variance scan — and measured PER TILE on a 3x3
 *      grid. Parallel world lanes give the same angle in every tile; a screen-space starburst
 *      gives an angle that rotates with position and tracks the direction away from image centre.
 *
 * ABLATION HYGIENE. The reflection is ablated through `renderer.quality.waterReflection = false`
 * (renderer.js:1415 -> `bindWaterReflection(null)`), NOT by writing `uWaterReflectionStrength`.
 * Writing the uniform is INERT: `bindWaterReflection` is called from the render loop every frame
 * and overwrites it before the next readback. The first version of this tool did that and read
 * ~1% where the truth is far larger; the arm is asserted live here, and an arm that changes
 * nothing is reported as inert rather than as a negative result (RULES rule 6).
 *
 * The two arms are produced in one process by live onBeforeCompile editing, as the builder's own
 * tools do it, so the arms cannot differ by anything except the factor under test:
 *      fixed  = HEAD                esGrazing = max(esFresnel, smoothstep(..)*.72*(1.-esView))
 *      prefix = the fix deleted     esGrazing = max(esFresnel, smoothstep(..)*.72)
 *
 * Usage:
 *   node tools/visual/f7-critic-look.mjs --site vista-deep-marshes --out <dir>
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
const SITE = String(args.site || 'vista-deep-marshes');
const TIME = Number(args.time || 13);
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/f7-critic/look/${SITE}`);
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '720x405').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));

/* ---------------------------------------------------------------- image measurement helpers */
function lum(buf) {
  const p = PNG.sync.read(buf);
  const y = new Float32Array(p.width * p.height);
  for (let i = 0, j = 0; i < p.data.length; i += 4, j++) y[j] = 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2];
  return { y, w: p.width, h: p.height };
}
/** High-pass by subtracting a 9-tap vertical box, matching the builder's own `hpRect`, so the two
 *  instruments look at the same band of spatial frequency and only the FIT differs. */
function highpass(o, [x0, x1, y0, y1]) {
  const X1 = Math.min(x1, o.w), Y1 = Math.min(y1, o.h), w = X1 - x0, hh = Y1 - y0;
  const out = new Float32Array(w * hh);
  for (let y = y0; y < Y1; y++) for (let x = x0; x < X1; x++) {
    let s = 0, c = 0;
    for (let k = -4; k <= 4; k++) { const yy = y + k; if (yy < 0 || yy >= o.h) continue; s += o.y[yy * o.w + x]; c++; }
    out[(y - y0) * w + (x - x0)] = o.y[y * o.w + x] - s / c;
  }
  return { h: out, w, hh };
}
/** Structure-tensor orientation: the direction the intensity RIDGES run, in screen degrees CCW
 *  from +x, plus a coherence in [0,1] (1 = perfectly parallel structure, 0 = isotropic). */
function orientation(h, w, hh) {
  let Jxx = 0, Jyy = 0, Jxy = 0;
  for (let y = 1; y < hh - 1; y++) for (let x = 1; x < w - 1; x++) {
    const gx = h[y * w + x + 1] - h[y * w + x - 1], gy = h[(y + 1) * w + x] - h[(y - 1) * w + x];
    Jxx += gx * gx; Jyy += gy * gy; Jxy += gx * gy;
  }
  const n = Math.max(1, (w - 2) * (hh - 2)); Jxx /= n; Jyy /= n; Jxy /= n;
  const gradDeg = 0.5 * Math.atan2(2 * Jxy, Jxx - Jyy) * 180 / Math.PI;
  let ridgeDeg = gradDeg + 90; while (ridgeDeg > 90) ridgeDeg -= 180; while (ridgeDeg <= -90) ridgeDeg += 180;
  const tr = Jxx + Jyy, disc = Math.sqrt((Jxx - Jyy) ** 2 + 4 * Jxy * Jxy);
  return { ridge_deg: +ridgeDeg.toFixed(1), coherence: +(tr > 0 ? disc / tr : 0).toFixed(3), energy: +tr.toFixed(4) };
}
function rms(o, [x0, x1, y0, y1]) {
  const X1 = Math.min(x1, o.w), Y1 = Math.min(y1, o.h);
  let s = 0, n = 0; for (let y = y0; y < Y1; y++) for (let x = x0; x < X1; x++) { s += o.y[y * o.w + x]; n++; }
  const m = s / n; let v = 0;
  for (let y = y0; y < Y1; y++) for (let x = x0; x < X1; x++) { const d = o.y[y * o.w + x] - m; v += d * d; }
  return { mean: +m.toFixed(3), rms: +Math.sqrt(v / n).toFixed(3) };
}
function diff(a, b, thr = 2) {
  const n = Math.min(a.y.length, b.y.length); let changed = 0, sum = 0;
  for (let i = 0; i < n; i++) { const d = Math.abs(a.y[i] - b.y[i]); sum += d; if (d > thr) changed++; }
  return { changed_pct: +(100 * changed / n).toFixed(2), mean_abs_delta: +(sum / n).toFixed(3) };
}
function mask(a, b, thr = 2) {
  const n = Math.min(a.y.length, b.y.length), m = new Uint8Array(n); let c = 0;
  for (let i = 0; i < n; i++) if (Math.abs(a.y[i] - b.y[i]) > thr) { m[i] = 1; c++; }
  return { m, count: c, pct: +(100 * c / n).toFixed(2) };
}
/** How much of a water pixel's own brightness does term X account for: mean|delta| on the water
 *  mask divided by the mean luminance of those same pixels. */
function shareOnMask(base, ablated, mk) {
  let s = 0, b = 0, n = 0;
  for (let i = 0; i < mk.m.length; i++) if (mk.m[i]) { s += Math.abs(base.y[i] - ablated.y[i]); b += base.y[i]; n++; }
  return n ? { n, mean_abs_delta: +(s / n).toFixed(3), mean_base_luma: +(b / n).toFixed(3), pct_of_water_pixel: +(100 * s / Math.max(1e-6, b)).toFixed(1) } : null;
}
/** 3x3 per-tile orientation. Parallel world lanes -> one angle everywhere. A screen-space
 *  starburst -> angles that track the direction from image centre to tile centre. */
function tileOrientations(o, [x0, x1, y0, y1]) {
  const X1 = Math.min(x1, o.w), Y1 = Math.min(y1, o.h);
  const tw = Math.floor((X1 - x0) / 3), th = Math.floor((Y1 - y0) / 3), tiles = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const rect = [x0 + c * tw, x0 + (c + 1) * tw, y0 + r * th, y0 + (r + 1) * th];
    const hp = highpass(o, rect), or = orientation(hp.h, hp.w, hp.hh);
    const cx = (rect[0] + rect[1]) / 2 - o.w / 2, cy = (rect[2] + rect[3]) / 2 - o.h / 2;
    let radial = Math.atan2(cy, cx) * 180 / Math.PI; while (radial > 90) radial -= 180; while (radial <= -90) radial += 180;
    let d = or.ridge_deg - radial; while (d > 90) d -= 180; while (d <= -90) d += 180;
    tiles.push({ tile: `r${r}c${c}`, ...or, radial_pred_deg: +radial.toFixed(1), dev_from_radial_deg: +d.toFixed(1) });
  }
  let sx = 0, sy = 0; for (const t of tiles) { sx += Math.cos(2 * t.ridge_deg * Math.PI / 180); sy += Math.sin(2 * t.ridge_deg * Math.PI / 180); }
  const centre = tiles[4];
  const spread = tiles.reduce((a, t) => { let d = t.ridge_deg - centre.ridge_deg; while (d > 90) d -= 180; while (d <= -90) d += 180; return a + Math.abs(d); }, 0) / tiles.length;
  return {
    tiles, circular_concentration: +(Math.hypot(sx, sy) / tiles.length).toFixed(3),
    mean_ridge_deg: +(0.5 * Math.atan2(sy, sx) * 180 / Math.PI).toFixed(1),
    mean_abs_dev_from_radial_deg: +(tiles.reduce((a, t) => a + Math.abs(t.dev_from_radial_deg), 0) / tiles.length).toFixed(1),
    mean_abs_dev_from_centre_tile_deg: +spread.toFixed(1),
    reading: 'parallel world lanes: dev_from_centre_tile small and dev_from_radial large. screen-space starburst: the reverse.',
  };
}

/* ------------------------------------------------------------------------------ browser setup */
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
await g.h('setWeather', 'clear');
await g.h('setTimeOfDay', TIME);
await step(10);
const snap = await g.h('snapshot');
const [px, py, pz] = snap.player.pos;

/* What region does the ENGINE think this is, and what does the on-screen label say? The builder
 * read a HUD label off a frame and concluded a deck site was broken. Record both, so a later
 * reader can tell a wrong site from a wrong label. */
const regionProbe = () => g.page.evaluate(({ px, pz }) => {
  const R = window.__ENGINE.renderer;
  let byField = null; try { const r = R.field && R.field.regionAt(px, pz); byField = r && (r.id || r.name) || null; } catch (e) { byField = 'ERR:' + e.message; }
  let label = null;
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (/^[a-z][a-z-]{3,29}$/.test(t) && /(rootlands|marsh|marshes|blackwood|coast|hive|clay|salt|stone|valus|thorn|wastes|forest|moor|hills)/.test(t)) { label = t; break; }
  }
  let water = null; try { water = window.__HARNESS.getWaterAt(px, pz); } catch (e) { water = 'ERR:' + e.message; }
  return { field_region: byField, dom_label: label, getWaterAt: water };
}, { px, pz });

async function shot(name) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(OUT, 'frames', `${name}.png`), buf);
  return buf;
}
async function pose(yawDeg, pitchDeg, dist) {
  const yaw = yawDeg * Math.PI / 180, pit = pitchDeg * Math.PI / 180;
  await g.h('camera', {
    pos: [px - Math.sin(yaw) * Math.cos(pit) * dist, py + 1.5 + Math.sin(-pit) * dist, pz - Math.cos(yaw) * Math.cos(pit) * dist],
    look: [px, py + 1.2, pz],
  });
}
const topdown = (h) => g.h('camera', { pos: [px, py + h, pz], look: [px, py, pz + 0.001] });

const scaleProbe = () => g.page.evaluate(({ px, py, pz, CW, CH }) => {
  const cam = window.__ENGINE.renderer.camera; cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  const proj = (x, y, z) => { const v = new (Object.getPrototypeOf(cam.position).constructor)(x, y, z); v.project(cam); return [(v.x * .5 + .5) * CW, (-v.y * .5 + .5) * CH]; };
  const D = 50, a = proj(px, py, pz), bx = proj(px + D, py, pz), bz = proj(px, py, pz + D);
  return {
    fov: cam.fov,
    m_per_px_X: +(D / Math.hypot(bx[0] - a[0], bx[1] - a[1])).toFixed(4),
    m_per_px_Z: +(D / Math.hypot(bz[0] - a[0], bz[1] - a[1])).toFixed(4),
    screen_deg_of_world_plusX: +(Math.atan2(bx[1] - a[1], bx[0] - a[0]) * 180 / Math.PI).toFixed(1),
    screen_deg_of_world_plusZ: +(Math.atan2(bz[1] - a[1], bz[0] - a[0]) * 180 / Math.PI).toFixed(1),
  };
}, { px, py, pz, CW, CH });

/* ------------------------------------------------------------------ live shader-arm machinery */
const applyEdits = (armId, edits) => g.page.evaluate(({ armId, edits }) => {
  const R = window.__ENGINE.renderer, mats = new Set();
  R.scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m && m.userData && m.userData.waterUniforms) mats.add(m); });
  window.__F7_EDITS = 0;
  for (const m of mats) {
    if (!m.__f7OrigOBC) m.__f7OrigOBC = m.onBeforeCompile;
    m.onBeforeCompile = function (shader, renderer) {
      m.__f7OrigOBC.call(this, shader, renderer);
      for (const [needle, rep] of edits) if (shader.fragmentShader.includes(needle)) { shader.fragmentShader = shader.fragmentShader.split(needle).join(rep); window.__F7_EDITS++; }
    };
    m.customProgramCacheKey = () => `f7-critic:${armId}`; m.needsUpdate = true;
  }
  return { materials: mats.size };
}, { armId, edits });
const editCount = () => g.page.evaluate(() => window.__F7_EDITS || 0);
const hideClass = (inc, exc) => g.page.evaluate(({ inc, exc }) => {
  const R = window.__ENGINE.renderer, I = new RegExp(inc), E = exc ? new RegExp(exc) : null;
  window.__F7_HID = []; let n = 0;
  R.scene.traverse((o) => { if (!(o.isMesh || o.isInstancedMesh) || !o.visible) return; const nm = o.name || ''; if (!I.test(nm) || (E && E.test(nm))) return; window.__F7_HID.push(o); o.visible = false; n++; });
  return n;
}, { inc, exc: exc || null });
const unhide = () => g.page.evaluate(() => { for (const o of (window.__F7_HID || [])) o.visible = true; window.__F7_HID = []; });
/** The reflection off-switch the renderer itself owns (renderer.js:1415). Writing
 *  `uWaterReflectionStrength` directly is inert — `bindWaterReflection` rewrites it every frame. */
const setReflection = (on) => g.page.evaluate((on) => {
  const R = window.__ENGINE.renderer; R.quality.waterReflection = !!on;
  return { quality: R.quality.waterReflection };
}, on);
const reflStrengthNow = () => g.page.evaluate(() => {
  const R = window.__ENGINE.renderer; const vals = new Set();
  R.scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { const u = m && m.userData && m.userData.waterUniforms; if (u) vals.add(+u.uWaterReflectionStrength.value.toFixed(3)); } });
  return [...vals];
});

const CROP = String(args.crop || '150,570,45,360').split(',').map(Number);
const POSES = [
  { id: 'a-topdown-120', run: () => topdown(120), why: "the builder's own pose — straight down at 120 m" },
  { id: 'b-pitch-55-d50', run: () => pose(90, -55, 50), why: 'half-way down' },
  { id: 'c-vista-11-d26', run: () => pose(Number(s.camera.yaw_deg ?? 90), -11, 26), deep: true, why: 'the deck vista pose — the shot a player judges a world by, and the RI-VIS03 M12 water_edge shot' },
  { id: 'e-eye-yaw090', run: () => pose(90, -8, 7), why: 'eye level — water as a player meets it' },
  { id: 'h-grazing-2', run: () => pose(45, -2, 12), why: 'nearly on the surface — the grazing case the fix deliberately does not move' },
];
const ARMS = [
  { id: 'fixed', edits: null, what: 'HEAD b0f3224e as shipped' },
  { id: 'prefix', what: 'the fix deleted: the (1.0-esView) factor removed from the distance term',
    edits: [['smoothstep(10.0,52.0,length(vViewPosition))*.72*(1.0-esView)', 'smoothstep(10.0,52.0,length(vViewPosition))*.72']] },
];

const results = {
  tool: 'f7-critic-look', site: SITE, generated: new Date().toISOString(), seed: SEED,
  canvas: [CW, CH], crop: CROP, time_of_day: TIME,
  player: [+px.toFixed(2), +py.toFixed(2), +pz.toFixed(2)],
  deck_declared_region: s.region, region_probe: await regionProbe(), arms: {},
};
fs.writeFileSync(path.join(OUT, 'look.json'), JSON.stringify(results, null, 2));

for (const arm of ARMS) {
  const armOut = { what: arm.what, poses: {} };
  if (arm.edits) {
    await applyEdits(arm.id, arm.edits); await step(8);
    armOut.edits_applied = await editCount();
    if (!armOut.edits_applied) { armOut.VACUOUS = 'FAIL — the arm matched nothing; it is not a result'; results.arms[arm.id] = armOut; continue; }
  }
  for (const p of POSES) {
    await p.run(); await step(8);
    const buf = await shot(`${arm.id}-${p.id}`); const L = lum(buf);
    const row = { why: p.why, ...rms(L, CROP) };
    if (p.id === 'a-topdown-120') {
      armOut.scale = await scaleProbe();
      const hp = highpass(L, CROP);
      row.orientation_whole_crop = orientation(hp.h, hp.w, hp.hh);
      row.orientation_by_tile = tileOrientations(L, CROP);
    }
    if (p.deep) {
      await setReflection(false); await step(8);
      const bufR = await shot(`${arm.id}-${p.id}-reflection-off`); const LR = lum(bufR);
      const strengthOff = await reflStrengthNow();
      await setReflection(true); await step(8);
      const strengthOn = await reflStrengthNow();
      await hideClass('^water', null); await step(6);
      const bufW = await shot(`${arm.id}-${p.id}-water-hidden`); await unhide(); await step(6);
      const wmask = mask(L, lum(bufW), 2);
      await hideClass('^water:shoreline:', null); await step(6);
      const bufS = await shot(`${arm.id}-${p.id}-shoreline-hidden`); await unhide(); await step(6);
      const smask = mask(L, lum(bufS), 2);
      row.ablation = {
        reflection_strength_when_off: strengthOff, reflection_strength_when_on: strengthOn,
        arm_live: JSON.stringify(strengthOff) !== JSON.stringify(strengthOn) ? 'LIVE' : 'INERT — do not read this row as a negative result',
        whole_frame: diff(L, LR, 2),
        reflection_share_of_water_pixel: shareOnMask(L, LR, wmask),
        water_coverage_pct: wmask.pct, shoreline_coverage_pct: smask.pct,
        shoreline_share_of_its_own_pixels: shareOnMask(L, lum(bufS), smask),
      };
    }
    armOut.poses[p.id] = row;
    process.stderr.write(`${arm.id}/${p.id}: rms ${row.rms} ${row.ablation ? `refl ${row.ablation.reflection_share_of_water_pixel?.pct_of_water_pixel}% water ${row.ablation.water_coverage_pct}% shore ${row.ablation.shoreline_coverage_pct}%` : ''}\n`);
    fs.writeFileSync(path.join(OUT, 'look.json'), JSON.stringify({ ...results, arms: { ...results.arms, [arm.id]: armOut } }, null, 2));
  }
  // MOTION — stationary, then a dolly. The dolly is the only condition that can photograph
  // renderer.js:1424's 0.24 m / 6-frame reflection reprojection gate.
  await POSES[2].run(); await step(8);
  const still = [];
  for (let i = 0; i < 5; i++) { still.push(lum(await shot(`${arm.id}-motion-still-${i}`))); await step(3); }
  const dolly = [];
  const yaw = Number(s.camera.yaw_deg ?? 90) * Math.PI / 180, pit = -11 * Math.PI / 180;
  for (let i = 0; i < 5; i++) {
    const d = 26 - i * 1.5;
    await g.h('camera', { pos: [px - Math.sin(yaw) * Math.cos(pit) * d, py + 1.5 + Math.sin(-pit) * d, pz - Math.cos(yaw) * Math.cos(pit) * d], look: [px, py + 1.2, pz] });
    await step(3); dolly.push(lum(await shot(`${arm.id}-motion-dolly-${i}`)));
  }
  const seq = (fr) => fr.slice(1).map((f, i) => diff(fr[i], f, 2));
  armOut.motion = { stationary_consecutive: seq(still), dolly_consecutive: seq(dolly) };
  results.arms[arm.id] = armOut;
  fs.writeFileSync(path.join(OUT, 'look.json'), JSON.stringify(results, null, 2));
}

const F = results.arms.fixed?.poses || {}, P = results.arms.prefix?.poses || {};
results.arm_comparison = {};
for (const k of Object.keys(F)) {
  if (!P[k]) continue;
  results.arm_comparison[k] = {
    prefix_rms: P[k].rms, fixed_rms: F[k].rms,
    delta_pct: +(100 * (F[k].rms - P[k].rms) / (P[k].rms || 1)).toFixed(1),
    prefix_refl_pct_of_water_pixel: P[k].ablation?.reflection_share_of_water_pixel?.pct_of_water_pixel ?? null,
    fixed_refl_pct_of_water_pixel: F[k].ablation?.reflection_share_of_water_pixel?.pct_of_water_pixel ?? null,
  };
}
fs.writeFileSync(path.join(OUT, 'look.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.arm_comparison, null, 2));
await g.close();
