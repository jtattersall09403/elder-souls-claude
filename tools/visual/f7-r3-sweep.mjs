#!/usr/bin/env node
/**
 * f7-r3-sweep.mjs — F7 ROUND 3 BUILDER. THE TWO MISSING MIN BAR COMPONENTS, MEASURED.
 *
 * WHAT ROUND 3 BUILT, AND THEREFORE WHAT THIS HAS TO SEPARATE. The r2 verdict's biggest_gap is
 * that `RI-VIS04` §9's MIN BAR has four components and TWO were absent from `water.js` outright:
 * depth-based colour and a shoreline depth fade. Round 3 adds both out of one mechanism —
 * Beer-Lambert extinction over the water column depth carried in province.js's vertex colour,
 * against the region's own `k` from `game/data/world/water.json`. So the arms below must be able
 * to tell apart: (i) the depth colour, (ii) the shoreline alpha half of it, (iii) the region's k
 * actually reaching the fragment, and (iv) a plain brightness change that has none of the above.
 *
 * THREE THINGS THIS TOOL DOES THAT THE ROUND-2 TOOLS DID NOT.
 *
 *  1. IT FREEZES THE WATER PHASE INSTEAD OF INTERLEAVING AROUND IT. The r2 critic proved the
 *     instrument is not noisy but ORDINAL: `f7-r2-sweep.mjs` advances the simulation between arms
 *     and never resets `uWaterPhase`, so capture order fixes the ripple phase and every cross-arm
 *     number in this piece's history carries a phase change as well as a shader change. Its own
 *     fix was to interleave and swap order, which cancels the drift to first order. This tool
 *     removes the variable instead: `uWaterPhase.value` is replaced by a getter returning a
 *     constant, so `updateVisualFoundationFrame`'s writes are ignored and every arm at every
 *     ordinal is measured at the SAME ripple field. `--mode band` then proves it worked, by
 *     capturing the untouched arm R times at R different ordinals: under a working freeze the
 *     readings are identical, and any spread that survives is the residual band.
 *
 *  2. IT READS THE REGION'S k OFF THE LIVE MATERIALS. `mat.userData.waterUniforms.uWaterK.value`
 *     and `mat.userData.waterRegionResolved` are reported for every water material in the scene,
 *     so "the Deep Marshes' k = 4.5 reached the shader" is a measurement and not an assumption.
 *     A run where the value is still the documented fallback is marked and its k rows are void.
 *
 *  3. IT MEASURES A GRADIENT WIDTH ACROSS THE WATERLINE, NOT ONLY M12's ShoreDelta. The r2 critic
 *     filed that `ShoreDelta` — |mean luma within 6 px of land - mean luma at 28-32 px| — scores
 *     `RI-VIS04` §9's OWN NAMED TELL ("a hard geometric line where the water plane intersects the
 *     terrain") HIGH: a hard line maximises it, a correct fade minimises it. Both numbers are
 *     reported here, always, side by side, and neither is tuned toward. The width is the 10%-90%
 *     rise distance of the mean luma profile as a function of distance-from-land inside the water
 *     mask: a hard line is a step over 1-2 px, a depth fade is the same delta over tens of px.
 *
 * WHAT IT CANNOT DO, SAID HERE SO IT IS NOT DISCOVERED LATER: it measures ONE region at ONE tide
 * state, like both prior rounds. The `k-*` arms substitute another region's k into the Deep
 * Marshes' material at the same pose; that proves k reaches the pixels and quantifies how much
 * colour a k difference buys, and it is NOT the same experiment as photographing two regions.
 *
 *   node tools/visual/f7-r3-sweep.mjs --out <dir> --mode band|arms|look --poses a,b,c
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
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/f7-r3/run');
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
const CROP = String(args.crop || '200,760,60,480').split(',').map(Number);
const REPS = Number(args.reps || 4);
const MODE = String(args.mode || 'arms');
const STEP = Number(args.step || 8);
const FROZEN_PHASE = Number(args.phase || 11.0);
const NULL_TRANS = Number(args.nullTrans || 0.08);
const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
const V = await import(path.join(REPO, 'tools/metrics/lib/vis03.mjs'));

const readPng = (b) => PNG.sync.read(b);
function lumOf(png) {
  const y = new Float32Array(png.width * png.height);
  for (let i = 0, j = 0; i < png.data.length; i += 4, j++) y[j] = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  return { y, w: png.width, h: png.height };
}
const inCrop = (i, w, [x0, x1, y0, y1]) => { const x = i % w, y = (i / w) | 0; return x >= x0 && x < x1 && y >= y0 && y < y1; };

/* ---- the r1/r2 lane estimator, reproduced so this round's lane rows are comparable to theirs.
 * EVERY number it emits is a brightness proxy per ARBITRATION S52 (the r2 critic added
 * `lane_aniso` and `band_contrast` to that family: a null dimmer with no Fresnel reproduces 71%
 * of the anisotropy rise). They are reported because S59 says report everything the instrument
 * emits, and they may not be quoted without the null-control row beside them. */
function bandpassRows(o) {
  const { y, w, h } = o, hp = new Float32Array(y.length);
  const K = 9, half = (K - 1) / 2;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    let s = 0, n = 0;
    for (let k = -half; k <= half; k++) { const cc = c + k; if (cc < 0 || cc >= w) continue; s += y[r * w + cc]; n++; }
    hp[r * w + c] = y[r * w + c] - s / n;
  }
  return hp;
}
function laneScan(o, mask, crop) {
  let best = { power: 0, deg: 0 }, sum = 0, n2 = 0;
  const { w, h } = o;
  for (let deg = -90; deg < 90; deg += 2) {
    const t = deg * Math.PI / 180, ct = Math.cos(t), st = Math.sin(t);
    const nb = 240, acc = new Float64Array(nb), cnt = new Float64Array(nb);
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i] || !inCrop(i, w, crop)) continue;
      const x = i % w, y = (i / w) | 0;
      const u = (x - w / 2) * ct + (y - h / 2) * st;
      const b = Math.min(nb - 1, Math.max(0, Math.floor((u + w) / (2 * w) * nb)));
      acc[b] += o.hp[i]; cnt[b]++;
    }
    let m = 0, c = 0; for (let b = 0; b < nb; b++) if (cnt[b] > 20) { m += acc[b] / cnt[b]; c++; }
    m = c ? m / c : 0;
    let v = 0; for (let b = 0; b < nb; b++) if (cnt[b] > 20) v += (acc[b] / cnt[b] - m) ** 2;
    v = c ? v / c : 0;
    sum += v; n2++;
    if (v > best.power) best = { power: v, deg };
  }
  const mean = n2 ? sum / n2 : 0;
  return { lane_bearing_screen_deg: best.deg, lane_power: +best.power.toFixed(4), lane_aniso: +(mean ? best.power / mean : 0).toFixed(2) };
}
function maskedStats(png, mask, crop) {
  const o = lumOf(png); o.hp = bandpassRows(o);
  let n = 0, sumY = 0, sumH = 0, sumH2 = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || !inCrop(i, o.w, crop)) continue;
    n++; sumY += o.y[i]; sumH += o.hp[i]; sumH2 += o.hp[i] * o.hp[i];
  }
  if (!n) return null;
  const meanY = sumY / n, meanH = sumH / n;
  const bandRms = Math.sqrt(Math.max(0, sumH2 / n - meanH * meanH));
  const lanes = laneScan(o, mask, crop);
  return {
    water_px_in_crop: n, mean_luma: +meanY.toFixed(3), band_rms: +bandRms.toFixed(4),
    band_contrast: +(bandRms / Math.max(1e-6, meanY)).toFixed(5),
    ...lanes, lane_power_normalised: +(lanes.lane_power / (meanY * meanY)).toFixed(6),
  };
}

/* ---- THE SHORELINE PROFILE. The measure the r2 critic said M12 is missing. ------------------
 * `dist` is a chamfer 3-4 distance transform from LAND, evaluated inside the water mask — the
 * same quantity M12's ShoreDelta bins at <=6 and 28-32. Instead of two bins we take the whole
 * profile L(d) for d = 1..48 and report the 10%-90% rise distance. A hard geometric line puts the
 * entire transition in 1-2 px; a depth fade spreads the same delta over tens. Reported together
 * with ShoreDelta so a critic can see them disagree if they do. */
function distanceFromLand(water, W, H) {
  const N = W * H, d = new Float32Array(N);
  for (let i = 0; i < N; i++) d[i] = water[i] ? 1e9 : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!d[i]) continue;
    let m = d[i];
    if (y > 0) m = Math.min(m, d[i - W] + 3);
    if (x > 0) m = Math.min(m, d[i - 1] + 3);
    if (y > 0 && x > 0) m = Math.min(m, d[i - W - 1] + 4);
    if (y > 0 && x < W - 1) m = Math.min(m, d[i - W + 1] + 4);
    d[i] = m;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; if (!d[i]) continue;
    let m = d[i];
    if (y < H - 1) m = Math.min(m, d[i + W] + 3);
    if (x < W - 1) m = Math.min(m, d[i + 1] + 3);
    if (y < H - 1 && x < W - 1) m = Math.min(m, d[i + W + 1] + 4);
    if (y < H - 1 && x > 0) m = Math.min(m, d[i + W - 1] + 4);
    d[i] = m;
  }
  for (let i = 0; i < N; i++) d[i] /= 3;
  return d;
}
function shoreProfile(png, water) {
  const o = lumOf(png), { w: W, h: H } = o, N = W * H;
  const dist = distanceFromLand(water, W, H);
  const MAXD = 48, sum = new Float64Array(MAXD + 1), cnt = new Float64Array(MAXD + 1);
  for (let i = 0; i < N; i++) {
    if (!water[i]) continue;
    const b = Math.round(dist[i]);
    if (b >= 1 && b <= MAXD) { sum[b] += o.y[i]; cnt[b]++; }
  }
  const prof = [];
  for (let b = 1; b <= MAXD; b++) prof.push(cnt[b] >= 40 ? +(sum[b] / cnt[b]).toFixed(3) : null);
  const usable = prof.map((v, i) => [i + 1, v]).filter(([, v]) => v !== null);
  if (usable.length < 12) return { profile: prof, gradient_width_px: null, reason: `only ${usable.length} distance bins carry >= 40 px; the waterline in this frame is too short to profile` };
  const first = usable[0][1], last = usable[usable.length - 1][1], span = last - first;
  if (Math.abs(span) < 0.6) return { profile: prof, gradient_width_px: null, near_shore_luma: first, open_water_luma: last, span: +span.toFixed(3), reason: 'near-shore and open-water luma differ by < 0.6/255; there is no transition to measure the width of' };
  const at = (frac) => {
    const target = first + span * frac;
    for (const [d, v] of usable) if (span > 0 ? v >= target : v <= target) return d;
    return usable[usable.length - 1][0];
  };
  const d10 = at(0.10), d90 = at(0.90);
  return {
    profile: prof, near_shore_luma: first, open_water_luma: last, span: +span.toFixed(3),
    d10_px: d10, d90_px: d90, gradient_width_px: Math.max(1, d90 - d10),
    note: 'width is the 10%-90% rise distance of mean luma vs distance-from-land inside the water mask. A hard intersection line is 1-2 px. RI-VIS04 §9 TELL names the hard line as the defect; M12 ShoreDelta scores it HIGH, which is why both are printed.',
  };
}

/* ------------------------------------------------------------------------- browser setup ---- */
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
const site = DECK.setups.find((x) => x.id === SITE);
await g.h('teleport', site.place.x, site.place.z);
await step(40);
await g.h('setWeather', 'clear');
await g.h('setTimeOfDay', TIME);
await step(12);
const snap = await g.h('snapshot');
const [px, py, pz] = snap.player.pos;

async function shot(name) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(OUT, 'frames', `${name}.png`), buf);
  return buf;
}
const topdown = (h) => g.h('camera', { pos: [px, py + h, pz], look: [px, py, pz + 0.001] });
async function pose(yawDeg, pitchDeg, dist) {
  const yaw = yawDeg * Math.PI / 180, pit = pitchDeg * Math.PI / 180;
  await g.h('camera', {
    pos: [px - Math.sin(yaw) * Math.cos(pit) * dist, py + 1.5 + Math.sin(-pit) * dist, pz - Math.cos(yaw) * Math.cos(pit) * dist],
    look: [px, py + 1.2, pz],
  });
}
const POSES = {
  'topdown-120': () => topdown(120),
  'c-vista-11-d26': () => pose(Number(site.camera.yaw_deg ?? 90), -11, 26),
  'd-water-edge': () => pose(Number(site.camera.yaw_deg ?? 90), -4, 14),
  ...Object.fromEntries([0, 45, 90, 135, 180, 225, 270, 315].map((y) => [`eye-yaw${String(y).padStart(3, '0')}`, () => pose(y, -8, 7)])),
  // THE SHOT NOBODY HAS TAKEN. Two builders and two critics have each named the shoreline
  // close-up as the picture that settles the ShoreDelta question, and none of the four took it.
  'shore-close-a': () => pose(Number(site.camera.yaw_deg ?? 90), -22, 4.5),
  'shore-close-b': () => pose(Number(site.camera.yaw_deg ?? 90) + 90, -18, 5.5),
  'shore-close-c': () => pose(Number(site.camera.yaw_deg ?? 90) + 180, -14, 7),
};

/* ---- phase freeze ------------------------------------------------------------------------- */
const freezePhase = (v) => g.page.evaluate((v) => {
  const R = window.__ENGINE.renderer, mats = new Set();
  R.scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m && m.userData && m.userData.waterUniforms) mats.add(m); });
  window.__R3_MATS_ALL = mats;
  let n = 0;
  for (const m of mats) {
    const u = m.userData.waterUniforms.uWaterPhase;
    if (!u.__r3Frozen) { Object.defineProperty(u, 'value', { get() { return v; }, set() { /* the sim's writes are deliberately dropped */ }, configurable: true }); u.__r3Frozen = true; }
    n++;
  }
  return { materials: n, frozen_at: v };
}, v);

/* ---- what actually reached the GPU --------------------------------------------------------- */
const gpuState = () => g.page.evaluate(() => {
  const R = window.__ENGINE.renderer, rows = [];
  R.scene.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) if (m && m.userData && m.userData.waterUniforms) {
      rows.push({ mesh: o.name || '(unnamed)', region_resolved: m.userData.waterRegionResolved || null,
        uWaterK: m.userData.waterUniforms.uWaterK ? m.userData.waterUniforms.uWaterK.value : null,
        uWaterShoreFade: m.userData.waterUniforms.uWaterShoreFade ? m.userData.waterUniforms.uWaterShoreFade.value : null,
        phase_frozen: !!m.userData.waterUniforms.uWaterPhase.__r3Frozen });
    }
  });
  const seen = new Set(), uniq = [];
  for (const r of rows) { const key = `${r.region_resolved}|${r.uWaterK}|${r.uWaterShoreFade}`; if (!seen.has(key)) { seen.add(key); uniq.push(r); } }
  return { water_materials: rows.length, distinct: uniq };
});

/* ---- arms ---------------------------------------------------------------------------------- */
const R3_BLOCK = `        float esQ=clamp(vEsWaterQ,.43,1.0);
        float esDepthM=clamp((esQ-.43)/.57,0.0,1.0)*1.35;
        vec3 esAlbedo=diffuseColor.rgb/max(esQ,.43);
        vec3 esDeepCol=vec3(.038,.105,.118)+esAlbedo*.21;
        vec3 esBedCol=vec3(.055,.064,.048)+esAlbedo*.34;
        float esPath=esDepthM*(1.0+1.0/max(esView,.22));
        float esTrans=exp(-max(uWaterK,.05)*esPath);
        vec3 esDepth=mix(esDeepCol,esBedCol,esTrans);`;
// The round-2 body colour, restored verbatim, with esTrans pinned to 0 so the shoreline alpha
// line below it becomes an identity (mix(a,b,0) == a). One edit, one arm, nothing else moved.
const R2_BLOCK = `        float esQ=1.0; float esDepthM=0.0; vec3 esAlbedo=diffuseColor.rgb;
        float esPath=0.0; float esTrans=0.0;
        vec3 esDepth=vec3(.038,.105,.118)+diffuseColor.rgb*.21;`;
const TRANS_LINE = `        float esTrans=exp(-max(uWaterK,.05)*esPath);`;
const ALPHA_LINE = `        diffuseColor.a=mix(diffuseColor.a,diffuseColor.a*.42,esTrans*clamp(uWaterShoreFade,0.0,1.0));`;

const waterSrc = fs.readFileSync(path.join(REPO, 'game/src/render/water.js'), 'utf8');
const asserted = {
  r3_depth_block: waterSrc.includes(R3_BLOCK),
  r2_schlick_weight: waterSrc.includes('float esF0=.02;'),
  shoreline_alpha_line: waterSrc.includes(ALPHA_LINE),
  region_k_uniform: waterSrc.includes('uWaterK:{value:waterRegionDiag.fallback_k}'),
  critic_grep_still_zero: (waterSrc.match(/depthTexture|tDepth|depthFade/g) || []).length === 0,
};

const SHADER_ARMS = {
  // The round-2 shipped shader: Schlick weight kept (the r2 verdict ruled "keep the change"),
  // depth colour and shoreline fade removed. This is the arm round 3 must beat.
  prefix: [[R3_BLOCK, R2_BLOCK]],
  // S52's plausible wrong answer. Transmittance becomes a CONSTANT: the same average lift of the
  // body colour toward the bed tint, with no depth dependence and no k dependence at all. Any
  // metric this moves as far as the real arm does is a brightness proxy and is inadmissible.
  'null-const-trans': [[TRANS_LINE, `        float esTrans=${NULL_TRANS.toFixed(4)};`]],
};
const UNIFORM_ARMS = {
  fixed: {}, 'nothing-restore-control': {},
  'no-shorefade': { uWaterShoreFade: 0 },
  'k-0.35-padomaic': { uWaterK: 0.35 },
  'k-1.4-topal': { uWaterK: 1.4 },
  'k-2.6-blackwood': { uWaterK: 2.6 },
};

const applyShaderArm = (armId, edits) => g.page.evaluate(({ armId, edits }) => {
  const mats = window.__R3_MATS_ALL || new Set();
  window.__R3_EDITS = 0;
  window.__R3_SEQ = (window.__R3_SEQ || 0) + 1;
  for (const m of mats) {
    if (!m.__r3OrigOBC) { m.__r3OrigOBC = m.onBeforeCompile; m.__r3OrigKey = m.customProgramCacheKey; }
    m.onBeforeCompile = function (shader, renderer) {
      m.__r3OrigOBC.call(this, shader, renderer);
      for (const [needle, rep] of edits) if (shader.fragmentShader.includes(needle)) { shader.fragmentShader = shader.fragmentShader.split(needle).join(rep); window.__R3_EDITS++; }
    };
    const key = `f7-r3:${armId}:${window.__R3_SEQ}`;
    m.customProgramCacheKey = () => key; m.needsUpdate = true;
  }
  return { materials: mats.size };
}, { armId, edits });
const editCount = () => g.page.evaluate(() => window.__R3_EDITS || 0);
const restoreShader = () => g.page.evaluate(() => {
  window.__R3_SEQ = (window.__R3_SEQ || 0) + 1;
  for (const m of (window.__R3_MATS_ALL || [])) if (m.__r3OrigOBC) { m.onBeforeCompile = m.__r3OrigOBC; m.customProgramCacheKey = m.__r3OrigKey; m.needsUpdate = true; }
});
const setUniforms = (over) => g.page.evaluate((over) => {
  let n = 0;
  for (const m of (window.__R3_MATS_ALL || [])) {
    const u = m.userData.waterUniforms;
    if (!m.__r3UBase) m.__r3UBase = { uWaterK: u.uWaterK.value, uWaterShoreFade: u.uWaterShoreFade.value };
    u.uWaterK.value = ('uWaterK' in over) ? over.uWaterK : m.__r3UBase.uWaterK;
    u.uWaterShoreFade.value = ('uWaterShoreFade' in over) ? over.uWaterShoreFade : m.__r3UBase.uWaterShoreFade;
    n++;
  }
  return n;
}, over);
const hideWater = () => g.page.evaluate(() => {
  const R = window.__ENGINE.renderer; window.__R3_HID = []; let n = 0;
  R.scene.traverse((o) => { if (!(o.isMesh || o.isInstancedMesh) || !o.visible) return; if (!/^water/.test(o.name || '')) return; window.__R3_HID.push(o); o.visible = false; n++; });
  return n;
});
const unhide = () => g.page.evaluate(() => { for (const o of (window.__R3_HID || [])) o.visible = true; window.__R3_HID = []; });

let commit = 'unknown';
try { commit = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim(); } catch (e) { /* real clone */ }

const out = {
  tool: 'f7-r3-sweep', generated: new Date().toISOString(), commit, seed: SEED,
  site: SITE, time_of_day: TIME, canvas: [CW, CH], crop: CROP, mode: MODE, reps: REPS,
  frozen_phase: FROZEN_PHASE, null_const_trans: NULL_TRANS,
  head_expression_asserted: asserted,
  refuses_to_measure_if: 'the round-3 depth block is not verbatim in game/src/render/water.js — every arm below would then be a fiction',
  gpu_state_before: null, phase_freeze: null,
  band: [], arms: {}, look: {}, pageErrors: [],
};
g.page.on('pageerror', (e) => out.pageErrors.push(String(e.message || e)));
const write = () => fs.writeFileSync(path.join(OUT, 'sweep.json'), JSON.stringify(out, null, 2));
write();
if (!asserted.r3_depth_block) { console.error('R3 DEPTH BLOCK NOT PRESENT IN water.js — refusing to measure'); await g.close(); process.exit(3); }

out.phase_freeze = await freezePhase(FROZEN_PHASE);
await step(6);
out.gpu_state_before = await gpuState();
write();
console.log('gpu state:', JSON.stringify(out.gpu_state_before.distinct));

/* ---- measurement ---------------------------------------------------------------------------- */
const maskCache = new Map();
async function maskFor(poseId) {
  if (maskCache.has(poseId)) return maskCache.get(poseId);
  await POSES[poseId](); await step(STEP);
  const n = await hideWater(); await step(4);
  const buf = await shot(`water-hidden-${poseId}`);
  await unhide(); await step(4);
  const png = readPng(buf);
  const rec = { png, meshes_hidden: n };
  maskCache.set(poseId, rec);
  return rec;
}
async function measure(poseId, name) {
  const base = await maskFor(poseId);
  await POSES[poseId](); await step(STEP);
  const buf = await shot(name);
  const png = readPng(buf);
  const N = png.width * png.height, m = new Uint8Array(N);
  let n = 0;
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const d = Math.abs(png.data[p] - base.png.data[p]) + Math.abs(png.data[p + 1] - base.png.data[p + 1]) + Math.abs(png.data[p + 2] - base.png.data[p + 2]);
    if (d > 6) { m[i] = 1; n++; }
  }
  const pl = V.prepare(png);
  const m12 = V.M12(pl, m, { sequence: [] });
  return {
    frame: `frames/${name}.png`, water_mask_px: n, water_mask_pct: +(100 * n / N).toFixed(2),
    m12: Object.fromEntries(Object.entries(m12).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(5) : v])),
    masked: maskedStats(png, m, CROP),
    shore: shoreProfile(png, m),
  };
}
async function runArm(poseId, armId, ordinal) {
  if (SHADER_ARMS[armId]) {
    await setUniforms({});
    const res = await applyShaderArm(armId, SHADER_ARMS[armId]);
    await step(6);
    const n = await editCount();
    if (!n) return { VACUOUS: `FAIL — the ${armId} edit matched nothing in the compiled shader. NOT a result and must not be read as one.`, materials: res.materials };
    const row = await measure(poseId, `${poseId}-${armId}-o${ordinal}`);
    row.edits_applied = n; row.materials = res.materials;
    await restoreShader(); await step(6);
    return row;
  }
  await restoreShader(); await setUniforms(UNIFORM_ARMS[armId] || {}); await step(6);
  const row = await measure(poseId, `${poseId}-${armId}-o${ordinal}`);
  row.uniforms = await gpuState();
  await setUniforms({});
  return row;
}

const spread = (vals) => {
  const v = vals.filter((x) => typeof x === 'number' && Number.isFinite(x));
  if (v.length < 2) return { n: v.length, note: 'fewer than two readings; no band' };
  const mn = Math.min(...v), mx = Math.max(...v), mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
  return { n: v.length, min: +mn.toFixed(5), max: +mx.toFixed(5), range: +(mx - mn).toFixed(5), mean: +mean.toFixed(5), sd: +sd.toFixed(5) };
};

const POSE_LIST = String(args.poses || 'c-vista-11-d26').split(',').map((s) => s.trim()).filter(Boolean);
for (const p of POSE_LIST) if (!POSES[p]) { console.error(`unknown pose ${p}`); await g.close(); process.exit(2); }

/* ---- 1. THE BAND, WHICH IS ALSO THE PROOF THE FREEZE WORKED -------------------------------- */
if (MODE === 'band') {
  const poseId = POSE_LIST[0];
  for (let r = 0; r < REPS; r++) {
    const row = await measure(poseId, `band-${poseId}-${r}`);
    row.replicate = r; row.arm = 'HEAD, untouched, phase FROZEN — every reading is the same ripple field at a different capture ordinal';
    out.band.push(row); write();
    console.log(`band ${r}: FD=${row.m12.FresnelDelta} SD=${row.m12.ShoreDelta} luma=${row.masked && row.masked.mean_luma} width=${row.shore && row.shore.gradient_width_px}`);
  }
  out.band_summary = {
    FresnelDelta: spread(out.band.map((r) => r.m12.FresnelDelta)),
    ShoreDelta: spread(out.band.map((r) => r.m12.ShoreDelta)),
    mean_luma: spread(out.band.map((r) => r.masked && r.masked.mean_luma)),
    gradient_width_px: spread(out.band.map((r) => r.shore && r.shore.gradient_width_px)),
    lane_power: spread(out.band.map((r) => r.masked && r.masked.lane_power)),
    reading: 'A range of exactly 0 on every row is the phase freeze working. Any residual spread IS the band and every arm delta below must be read against it (S61: a statistic may fail a build on one capture and may never pass one).',
  };
  write();
}

/* ---- 2. THE ARMS ---------------------------------------------------------------------------- */
if (MODE === 'arms') {
  const ARMS = String(args.arms || 'prefix,fixed,no-shorefade,null-const-trans,k-0.35-padomaic,k-1.4-topal,k-2.6-blackwood,nothing-restore-control').split(',');
  for (const poseId of POSE_LIST) {
    out.arms[poseId] = {};
    let ord = 0;
    for (const armId of ARMS) {
      const row = await runArm(poseId, armId, ord++);
      out.arms[poseId][armId] = row; write();
      console.log(`${poseId} ${armId}: FD=${row.m12 && row.m12.FresnelDelta} SD=${row.m12 && row.m12.ShoreDelta} luma=${row.masked && row.masked.mean_luma} width=${row.shore && row.shore.gradient_width_px} lanePow=${row.masked && row.masked.lane_power} aniso=${row.masked && row.masked.lane_aniso}${row.VACUOUS ? ' VACUOUS' : ''}`);
    }
    const A = out.arms[poseId];
    if (A.prefix && A.fixed && A.prefix.m12 && A.fixed.m12) {
      out.arms[poseId].__delta_r2_to_r3 = {
        FresnelDelta: +(A.fixed.m12.FresnelDelta - A.prefix.m12.FresnelDelta).toFixed(5),
        ShoreDelta: +(A.fixed.m12.ShoreDelta - A.prefix.m12.ShoreDelta).toFixed(5),
        gradient_width_px: (A.fixed.shore && A.prefix.shore) ? [A.prefix.shore.gradient_width_px, A.fixed.shore.gradient_width_px] : null,
        mean_luma_pct: A.prefix.masked ? +(100 * (A.fixed.masked.mean_luma - A.prefix.masked.mean_luma) / A.prefix.masked.mean_luma).toFixed(2) : null,
        lane_power_pct: A.prefix.masked ? +(100 * (A.fixed.masked.lane_power - A.prefix.masked.lane_power) / A.prefix.masked.lane_power).toFixed(2) : null,
        lane_aniso: A.prefix.masked ? [A.prefix.masked.lane_aniso, A.fixed.masked.lane_aniso] : null,
        s52_null_row: A['null-const-trans'] && A['null-const-trans'].masked ? {
          mean_luma: A['null-const-trans'].masked.mean_luma, lane_power: A['null-const-trans'].masked.lane_power,
          lane_aniso: A['null-const-trans'].masked.lane_aniso,
          ShoreDelta: A['null-const-trans'].m12.ShoreDelta,
          gradient_width_px: A['null-const-trans'].shore && A['null-const-trans'].shore.gradient_width_px,
          why: 'a CONSTANT transmittance — the same average lift with no depth and no k. Every metric it moves as far as `fixed` does is a brightness proxy (S52) and is inadmissible in both directions.',
        } : null,
      };
      write();
    }
  }
}

/* ---- 3. THE LOOK: many bearings, both arms, and the shoreline close-up nobody has taken ----- */
if (MODE === 'look') {
  const ARMS = String(args.arms || 'prefix,fixed').split(',');
  for (const poseId of POSE_LIST) {
    out.look[poseId] = {};
    let ord = 0;
    for (const armId of ARMS) {
      const row = await runArm(poseId, armId, ord++);
      out.look[poseId][armId] = row; write();
      console.log(`look ${poseId} ${armId}: FD=${row.m12 && row.m12.FresnelDelta} SD=${row.m12 && row.m12.ShoreDelta} luma=${row.masked && row.masked.mean_luma} width=${row.shore && row.shore.gradient_width_px}${row.VACUOUS ? ' VACUOUS' : ''}`);
    }
    const A = out.look[poseId];
    if (A.prefix && A.fixed && A.prefix.m12 && A.fixed.m12 && !A.prefix.VACUOUS) {
      A.__delta = {
        FresnelDelta: +(A.fixed.m12.FresnelDelta - A.prefix.m12.FresnelDelta).toFixed(5),
        ShoreDelta: +(A.fixed.m12.ShoreDelta - A.prefix.m12.ShoreDelta).toFixed(5),
        mean_luma_pct: +(100 * (A.fixed.masked.mean_luma - A.prefix.masked.mean_luma) / A.prefix.masked.mean_luma).toFixed(2),
        gradient_width_px: [A.prefix.shore.gradient_width_px, A.fixed.shore.gradient_width_px],
      };
      write();
    }
  }
}

out.gpu_state_after = await gpuState();
write();
await g.close();
console.log(`\nwrote ${path.join(OUT, 'sweep.json')}`);
