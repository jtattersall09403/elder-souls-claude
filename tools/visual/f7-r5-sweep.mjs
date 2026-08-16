#!/usr/bin/env node
/**
 * f7-r5-sweep.mjs — F7 ROUND 5. INTERLEAVED BASELINE, `presence` ON EVERY ROW, AND MOTION.
 *
 * WHY A NEW TOOL AND NOT AN EDIT OF `f7-r4-sweep.mjs`. `node tools/ownership.mjs --for
 * tools/visual/f7-r4-sweep.mjs`, run this turn, reports `tools/visual/` claimed as a DIRECTORY by a
 * live piece (`W1-30V`), so every F7 round has added a file rather than edited one. More
 * importantly the r4 tool has a structural defect that cannot be patched out of it, below.
 *
 * ── THE DEFECT THIS TOOL EXISTS TO REMOVE ─────────────────────────────────────────────────────
 *
 * HAZARDS §25a, written from round 4's own numbers: in ALL SIX runs available, `own_mask_delta_pct`
 * rises MONOTONICALLY WITH CAPTURE ORDINAL, and the falsifier is the null arm — `no-shorefade` has
 * the pin arm's own water alpha, so it must move the mask LEAST, and it moves it MOST because it is
 * captured last. The r4 tool takes ONE baseline (`prefix`) at ordinal 0 and then measures every arm
 * against it across five to eight shader round-trips. So every arm's number carries all the drift
 * accumulated between ordinal 0 and its own ordinal, and the drift is confounded with the dose,
 * because arms are written in order of increasing band — §25a's "worst possible order".
 *
 * The r4 tool's published band does not cover this: it is a PIN -> PIN2 back-to-back replicate,
 * i.e. drift over ONE capture interval, quoted as the noise floor of a comparison spanning eight.
 *
 * ── WHAT THIS TOOL DOES INSTEAD, AND IT IS THE WHOLE POINT ────────────────────────────────────
 *
 *  1. THE BASELINE IS RE-CAPTURED BEFORE AND AFTER EVERY ARM (`--interleave`, default on). The
 *     sequence is base, arm1, base, arm2, base, ... base. Each arm is then read against the MEAN OF
 *     ITS TWO FLANKING BASELINES, which are one capture interval away on each side instead of
 *     eight. Monotonic drift cancels to first order by construction rather than by argument. This
 *     is §25a's rule 1 and 3 taken to their conclusion: instead of putting ONE null arm last to
 *     size the drift, put the null between every pair of arms and subtract it.
 *
 *  2. THE DRIFT BAND IS THEN MEASURED, NOT ASSUMED — from the baseline's own repeated captures, at
 *     the ordinals the arms actually span. `baseline_drift` reports the spread of the identical
 *     unchanged arm across all its ordinals, for EVERY published quantity: mask px, mean luma,
 *     `presence`, and `gradient_width_px` at each threshold. **That spread is the number to print
 *     beside every result in this round**, and it is what tells us which threshold is stable.
 *
 *  3. `presence` IS ON EVERY ROW. presence = (L[arm] - L[base]) / (L[base] - L[hidden]) + 1, i.e.
 *     the share of the baseline's VISIBLE WATER that survives, where 0 is the frame with all water
 *     meshes hidden and 1 is the baseline. Every artifact in this piece has carried a
 *     `--water-hidden` frame since round 2 and no round scored it. Re-derived offline in
 *     `f7-r5-offline.mjs` over round 4's own banked frames, it is threshold-independent to within
 *     0.59 percentage points across thresholds 4/6/10/16 — which `gradient_width_px` is emphatically
 *     not. It costs one frame that is already being taken.
 *
 *  4. `--order reverse` RUNS THE ARM SEQUENCE BACKWARDS. §25a rule 2: if an ordering reverses with
 *     the sequence it was ordinal, not the arm. Nobody has ever run this for F7.
 *
 *  5. `--mode motion` SHOOTS MOTION, WHICH FIVE ROUNDS HAVE NOT. Two sequences, both with
 *     `uWaterPhase` LIVE rather than frozen: an ORBIT (the camera circles the declared waterline
 *     target, N bearings, so the waterline is judged from many angles as CLAUDE.md's character
 *     directive requires of every visual claim) and a STATIONARY run of >= 30 frames, which is
 *     `RI-VIS03` M12's `TemporalVar` — a fifth-round debt. Every frame is written out so a critic
 *     can flip them.
 *
 *  6. `--mode supersample` IS `RI-VIS04` §8's TEST, a fourth-round debt. The same pose is captured
 *     at 1x and at 2x linear resolution and the 2x frame is box-downsampled to 1x. High-frequency
 *     energy that survives supersampling is real surface detail; energy that collapses was
 *     aliasing. This is what separates a passing `NormalEnergy` from the stipple four critics have
 *     named — see `f7-r5-offline.mjs --mode stipple`, which falsifies the "ordered dither" reading
 *     of it at 4x4 phase and 2x2 parity.
 *
 *   node tools/visual/f7-r5-sweep.mjs --out <dir> --site <deck id> --mode arms|motion|supersample
 *                                     --poses edge-b225 --bands 0.05,0.10,0.20,0.30,0.60,1.20
 *                                     [--order reverse] [--nointerleave]
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
const CENSUS_PATH = path.join(REPO, args.census || 'corpus/90-verdicts/wave1/artifacts/W1-F7-WATER-r4/shoreline-census.json');
const CENSUS = JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf8'));
const SITE = String(args.site || 'vista-deep-marshes');
const TIME = Number(args.time || 13);
const OUT = path.resolve(REPO, args.out || 'corpus/90-verdicts/wave1/artifacts/W1-F7-WATER-r5/run');
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
const MODE = String(args.mode || 'arms');
const STEP_F = Number(args.step || 8);
const FROZEN_PHASE = Number(args.phase || 11.0);
const BASE_ARM = String(args.baseArm || 'prefix');
const MASK_THRESHOLDS = String(args.thresholds || '6,10,16').split(',').map(Number);
const CLOSE_R = Number(args.closeR || 4);
const INTERLEAVE = !args.nointerleave;
const ORDER = String(args.order || 'forward');
const MOTION_FRAMES = Number(args.motionFrames || 32);
const ORBIT_BEARINGS = Number(args.orbitBearings || 12);
const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
const V = await import(path.join(REPO, 'tools/metrics/lib/vis03.mjs'));

const readPng = (b) => PNG.sync.read(b);
function lumOf(png) {
  const y = new Float32Array(png.width * png.height);
  for (let i = 0, j = 0; i < png.data.length; i += 4, j++) y[j] = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  return { y, w: png.width, h: png.height };
}
/* distance transform + morphological closing: carried over UNCHANGED from the r4 tool so the width
 * rows stay comparable round to round. The r4 critic attacked the closing directly and found it is
 * the RELIABLE half — the closed width reproduced across processes on every arm while `shore_raw`
 * moved 1 -> 33 on an unchanged arm. It is applied to the PIN, so it is identical for every arm. */
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
function closeMask(m, W, H, r) {
  const N = W * H, dil = new Uint8Array(N), out = new Uint8Array(N);
  const box = (src, dst, want) => {
    const tmp = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = want ? 0 : 1;
      for (let k = -r; k <= r; k++) { const xx = x + k; if (xx < 0 || xx >= W) continue; const s = src[y * W + xx]; v = want ? (v | s) : (v & s); }
      tmp[y * W + x] = v;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = want ? 0 : 1;
      for (let k = -r; k <= r; k++) { const yy = y + k; if (yy < 0 || yy >= H) continue; const s = tmp[yy * W + x]; v = want ? (v | s) : (v & s); }
      dst[y * W + x] = v;
    }
  };
  box(m, dil, true); box(dil, out, false);
  let moved = 0;
  for (let i = 0; i < N; i++) if (out[i] !== m[i]) moved++;
  return { closed: out, moved };
}
function shoreProfile(png, mask, distCache) {
  const o = lumOf(png), { w: W, h: H } = o, N = W * H;
  const dist = distCache || distanceFromLand(mask, W, H);
  const MAXD = 48, sum = new Float64Array(MAXD + 1), cnt = new Float64Array(MAXD + 1);
  for (let i = 0; i < N; i++) {
    if (!mask[i]) continue;
    const b = Math.round(dist[i]);
    if (b >= 1 && b <= MAXD) { sum[b] += o.y[i]; cnt[b]++; }
  }
  const prof = [];
  for (let b = 1; b <= MAXD; b++) prof.push(cnt[b] >= 40 ? +(sum[b] / cnt[b]).toFixed(3) : null);
  const usable = prof.map((v, i) => [i + 1, v]).filter(([, v]) => v !== null);
  if (usable.length < 12) return { gradient_width_px: null, reason: `only ${usable.length} distance bins carry >= 40 px` };
  const nearBins = usable.filter(([d]) => d <= 2).map(([, v]) => v);
  const plateauBins = usable.filter(([d]) => d >= 24).map(([, v]) => v).sort((a, b) => a - b);
  if (!nearBins.length || plateauBins.length < 6) return { gradient_width_px: null, reason: 'not enough near-shore or open-water bins' };
  const first = nearBins.reduce((a, b) => a + b, 0) / nearBins.length;
  const last = plateauBins[Math.floor(plateauBins.length / 2)];
  const span = last - first;
  if (Math.abs(span) < 0.6) return { gradient_width_px: null, near_shore_luma: +first.toFixed(3), open_water_luma: +last.toFixed(3), span: +span.toFixed(3), reason: 'near-shore and open-water luma differ by < 0.6/255' };
  const at = (frac) => { const t = first + span * frac; for (const [d, v] of usable) if (span > 0 ? v >= t : v <= t) return d; return usable[usable.length - 1][0]; };
  const d10 = at(0.10), d90 = at(0.90);
  return { profile: prof, near_shore_luma: +first.toFixed(3), open_water_luma: +last.toFixed(3), span: +span.toFixed(3), d10_px: d10, d90_px: d90, gradient_width_px: Math.max(1, d90 - d10) };
}
function maskedLuma(png, mask) {
  const o = lumOf(png); let n = 0, s = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) { n++; s += o.y[i]; }
  return { px: n, mean_luma: n ? +(s / n).toFixed(3) : null };
}
/** mean of vis03's perceptual Yp (0..1) over the mask — the unit `TemporalVar`'s band is in. */
function meanYp(png, mask) {
  const pl = V.prepare(png); let s = 0, n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) { s += pl.Yp[i]; n++; }
  return n ? s / n : null;
}
const spread = (vs) => { const f = vs.filter((v) => typeof v === 'number'); return f.length < 2 ? null : { n: f.length, min: +Math.min(...f).toFixed(4), max: +Math.max(...f).toFixed(4), range: +(Math.max(...f) - Math.min(...f)).toFixed(4), mean: +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(4) }; };

/* ------------------------------------------------------------------------- browser setup ---- */
const g = await launchGame({ entry: 'game/index.html', width: CW, height: CH });
await g.h('ready');
const setCanvas = (w, h) => g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  const r = window.__ENGINE.renderer;
  if (r.renderer && r.renderer.setPixelRatio) r.renderer.setPixelRatio(1);
  r.setSize(w, h);
}, { w, h });
await setCanvas(CW, CH);
await g.h('setSeed', SEED);
const step = (n) => g.h('stepFrames', n);
const site = DECK.setups.find((x) => x.id === SITE);
if (!site) { console.error(`unknown deck site ${SITE}`); await g.close(); process.exit(2); }
await g.h('teleport', site.place.x, site.place.z);
await step(40);
await g.h('setWeather', 'clear');
await g.h('setTimeOfDay', TIME);
await step(12);
const snap = await g.h('snapshot');
const [px, py, pz] = snap.player.pos;

const standCheck = await g.page.evaluate(({ tx, tz }) => {
  const E = window.__ENGINE, f = E.field, p = E.sim.player.pos;
  const rAt = (x, z) => { const r = f && f.regionAt ? f.regionAt(x, z) : null; return r ? (r.id || r.name) : null; };
  return {
    deck_asked_for: [tx, tz],
    player_pos_after_teleport: [+p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2)],
    teleport_offset_m: +Math.hypot(p[0] - tx, p[2] - tz).toFixed(2),
    running_field_region_at_deck_point: rAt(tx, tz),
    running_field_region_at_player: rAt(p[0], p[2]),
    note: 'The DRAWN HUD label is stale — confirmed by the r4 critic at 4 of 4 poses. Read this block, never the label in the frame.',
  };
}, { tx: site.place.x, tz: site.place.z });
console.log('stand:', JSON.stringify(standCheck));

async function shot(name) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(OUT, 'frames', `${name}.png`), buf);
  return buf;
}

const censusRow = CENSUS.rows.find((r) => r.setup === SITE);
if (!censusRow) { console.error(`site ${SITE} is not in ${CENSUS_PATH}`); await g.close(); process.exit(2); }
const EDGE_TARGETS = new Map((censusRow.declared_pose_targets || []).filter(Boolean).map((t) => [t.bearing_deg, t]));

async function orbit(yawDeg, pitchDeg, dist) {
  const yaw = yawDeg * Math.PI / 180, pit = pitchDeg * Math.PI / 180;
  await g.h('camera', {
    pos: [px - Math.sin(yaw) * Math.cos(pit) * dist, py + 1.5 + Math.sin(-pit) * dist, pz - Math.cos(yaw) * Math.cos(pit) * dist],
    look: [px, py + 1.2, pz],
  });
}
async function edgePose(bearingDeg, backM = 11, heightM = 3.0) {
  const t = EDGE_TARGETS.get(bearingDeg);
  if (!t) return { ok: false, why: `no waterline cell within the census cone on bearing ${bearingDeg}` };
  const b = bearingDeg * Math.PI / 180;
  const [tx, tz] = t.cell_centre;
  const wy = (t.water_y === null || t.water_y === undefined) ? t.ground_y : t.water_y;
  await g.h('camera', { pos: [tx - Math.sin(b) * backM, wy + heightM, tz - Math.cos(b) * backM], look: [tx, wy, tz] });
  return { ok: true, target: t };
}
/** MOTION: circle the declared waterline target at a fixed radius, looking at it. This is the
 * "orbit the camera around it, many angles" the character directive demands of every visual claim
 * and that no F7 round has ever shot. Bearing is continuous, not one of the four declared ones. */
async function orbitEdge(targetBearing, aroundDeg, backM = 11, heightM = 3.0) {
  const t = EDGE_TARGETS.get(targetBearing);
  if (!t) return { ok: false, why: `no waterline cell on bearing ${targetBearing}` };
  const b = aroundDeg * Math.PI / 180;
  const [tx, tz] = t.cell_centre;
  const wy = (t.water_y === null || t.water_y === undefined) ? t.ground_y : t.water_y;
  await g.h('camera', { pos: [tx - Math.sin(b) * backM, wy + heightM, tz - Math.cos(b) * backM], look: [tx, wy, tz] });
  return { ok: true, target: t, around_deg: aroundDeg };
}
const POSES = {
  'c-vista-11-d26': async () => { await orbit(Number(site.camera.yaw_deg ?? 90), -11, 26); return { ok: true, kind: 'vista' }; },
  ...Object.fromEntries([45, 135, 225, 315].map((b) => [`edge-b${String(b).padStart(3, '0')}`,
    async () => ({ ...(await edgePose(b)), kind: 'water_edge', bearing_deg: b })])),
};

const project = (x, y, z) => g.h('projectPoint', x, y, z);

const freezePhase = (v) => g.page.evaluate((v) => {
  const R = window.__ENGINE.renderer, mats = new Set();
  R.scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m && m.userData && m.userData.waterUniforms) mats.add(m); });
  window.__R5_MATS = mats;
  let n = 0;
  for (const m of mats) {
    const u = m.userData.waterUniforms.uWaterPhase;
    if (v === null) { if (u.__r5Frozen) { delete u.__r5Frozen; } }
    else if (!u.__r5Frozen) { Object.defineProperty(u, 'value', { get() { return v; }, set() { /* dropped */ }, configurable: true }); u.__r5Frozen = true; }
    n++;
  }
  return { materials: n, frozen_at: v };
}, v);
/** Collect the water materials WITHOUT freezing — motion mode needs the phase live. */
const collectMats = () => g.page.evaluate(() => {
  const R = window.__ENGINE.renderer, mats = new Set();
  R.scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m && m.userData && m.userData.waterUniforms) mats.add(m); });
  window.__R5_MATS = mats;
  return { materials: mats.size, phase_frozen: false };
});

const gpuState = () => g.page.evaluate(() => {
  const R = window.__ENGINE.renderer, rows = [];
  R.scene.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) if (m && m.userData && m.userData.waterUniforms) {
      const u = m.userData.waterUniforms;
      rows.push({ mesh: o.name || '(unnamed)', region_resolved: m.userData.waterRegionResolved || null,
        uWaterK: u.uWaterK ? u.uWaterK.value : null,
        uWaterShoreFade: u.uWaterShoreFade ? u.uWaterShoreFade.value : null,
        uWaterShoreBandM: u.uWaterShoreBandM ? u.uWaterShoreBandM.value : 'ABSENT — build predates F7 r4',
        phase_frozen: !!u.uWaterPhase.__r5Frozen,
        transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite, depthTest: m.depthTest, renderOrder: o.renderOrder });
    }
  });
  const seen = new Set(), uniq = [];
  for (const r of rows) { const key = `${r.region_resolved}|${r.uWaterK}|${r.uWaterShoreFade}|${r.uWaterShoreBandM}`; if (!seen.has(key)) { seen.add(key); uniq.push(r); } }
  return { water_materials: rows.length, distinct: uniq };
});

/* ---- arms ----------------------------------------------------------------------------------- */
const R3_DEPTH_BLOCK = `        float esQ=clamp(vEsWaterQ,.43,1.0);
        float esDepthM=clamp((esQ-.43)/.57,0.0,1.0)*1.35;
        vec3 esAlbedo=diffuseColor.rgb/max(esQ,.43);
        vec3 esDeepCol=vec3(.038,.105,.118)+esAlbedo*.21;
        vec3 esBedCol=vec3(.055,.064,.048)+esAlbedo*.34;
        float esPath=esDepthM*(1.0+1.0/max(esView,.22));
        float esTrans=exp(-max(uWaterK,.05)*esPath);
        vec3 esDepth=mix(esDeepCol,esBedCol,esTrans);`;
const R4_SHORE_BLOCK = `        float esBandM=1.0-smoothstep(0.0,max(uWaterShoreBandM,1e-4),esDepthM);
        float esShoreT=1.0-(1.0-esTrans)*(1.0-esBandM);
        diffuseColor.a=mix(diffuseColor.a,diffuseColor.a*.42,esShoreT*clamp(uWaterShoreFade,0.0,1.0));`;
const BAND_LINE = `        float esBandM=1.0-smoothstep(0.0,max(uWaterShoreBandM,1e-4),esDepthM);`;
const TRANS_LINE = `        float esTrans=exp(-max(uWaterK,.05)*esPath);`;
const R2_DEPTH_BLOCK = `        float esQ=1.0; float esDepthM=0.0; vec3 esAlbedo=diffuseColor.rgb;
        float esPath=0.0; float esTrans=0.0;
        vec3 esDepth=vec3(.038,.105,.118)+diffuseColor.rgb*.21;`;
const R2_SHORE_BLOCK = `        float esBandM=0.0; float esShoreT=0.0;`;

const waterSrc = fs.readFileSync(path.join(REPO, 'game/src/render/water.js'), 'utf8');
const bandDefault = (waterSrc.match(/uWaterShoreBandM:\{value:([0-9.]+)\}/) || [])[1] || null;
const asserted = {
  r3_depth_block: waterSrc.includes(R3_DEPTH_BLOCK),
  r4_shore_band_block: waterSrc.includes(R4_SHORE_BLOCK),
  r2_schlick_weight: waterSrc.includes('float esF0=.02;'),
  shore_band_uniform_default: bandDefault,
  region_k_uniform: waterSrc.includes('uWaterK:{value:waterRegionDiag.fallback_k}'),
  critic_grep_still_zero: (waterSrc.match(/depthTexture|tDepth|depthFade/g) || []).length === 0,
  backtick_count_in_file: (waterSrc.match(/`/g) || []).length,
};

let NULL_TRANS = Number(args.nullTrans || 0.5);
const SHADER_ARMS = () => ({
  prefix: [[R3_DEPTH_BLOCK, R2_DEPTH_BLOCK], [R4_SHORE_BLOCK, R2_SHORE_BLOCK]],
  // S52's plausible wrong answer: a CONSTANT transmittance with the metre band deleted, so the
  // frame has the same average brightness change with NO depth dependence, NO k and NO shore
  // geometry. Anything it reproduces is a brightness proxy and inadmissible in both directions.
  'null-const-trans': [[TRANS_LINE, `        float esTrans=${NULL_TRANS.toFixed(4)};`], [BAND_LINE, `        float esBandM=0.0;`]],
});
/** Bands are generated from `--bands` so the sweep below 0.60 at the FAILING pose — which nobody
 * has run and which the r4 critic named as the gap in its own ruling — is one flag, not an edit. */
const BANDS = String(args.bands || '0.05,0.10,0.20,0.30,0.60,1.20').split(',').map(Number).filter((v) => v > 0);
const UNIFORM_ARMS = Object.assign({
  fixed: {},
  r3: { uWaterShoreBandM: 0.0001 },
  'no-shorefade': { uWaterShoreFade: 0 },
}, Object.fromEntries(BANDS.map((b) => [`band-${b.toFixed(2)}`, { uWaterShoreBandM: b }])));

const applyShaderArm = (armId, edits) => g.page.evaluate(({ armId, edits }) => {
  const mats = window.__R5_MATS || new Set();
  window.__R5_EDITS = 0;
  window.__R5_SEQ = (window.__R5_SEQ || 0) + 1;
  for (const m of mats) {
    if (!m.__r5OrigOBC) { m.__r5OrigOBC = m.onBeforeCompile; m.__r5OrigKey = m.customProgramCacheKey; }
    m.onBeforeCompile = function (shader, renderer) {
      m.__r5OrigOBC.call(this, shader, renderer);
      for (const [needle, rep] of edits) if (shader.fragmentShader.includes(needle)) { shader.fragmentShader = shader.fragmentShader.split(needle).join(rep); window.__R5_EDITS++; }
    };
    const key = `f7-r5:${armId}:${window.__R5_SEQ}`;
    m.customProgramCacheKey = () => key; m.needsUpdate = true;
  }
  return { materials: mats.size, edits_expected: edits.length };
}, { armId, edits });
const editCount = () => g.page.evaluate(() => window.__R5_EDITS || 0);
const restoreShader = () => g.page.evaluate(() => {
  window.__R5_SEQ = (window.__R5_SEQ || 0) + 1;
  for (const m of (window.__R5_MATS || [])) if (m.__r5OrigOBC) { m.onBeforeCompile = m.__r5OrigOBC; m.customProgramCacheKey = m.__r5OrigKey; m.needsUpdate = true; }
});
const setUniforms = (over) => g.page.evaluate((over) => {
  let n = 0;
  for (const m of (window.__R5_MATS || [])) {
    const u = m.userData.waterUniforms;
    if (!m.__r5UBase) m.__r5UBase = { uWaterK: u.uWaterK.value, uWaterShoreFade: u.uWaterShoreFade.value, uWaterShoreBandM: u.uWaterShoreBandM ? u.uWaterShoreBandM.value : null };
    u.uWaterK.value = ('uWaterK' in over) ? over.uWaterK : m.__r5UBase.uWaterK;
    u.uWaterShoreFade.value = ('uWaterShoreFade' in over) ? over.uWaterShoreFade : m.__r5UBase.uWaterShoreFade;
    if (u.uWaterShoreBandM) u.uWaterShoreBandM.value = ('uWaterShoreBandM' in over) ? over.uWaterShoreBandM : m.__r5UBase.uWaterShoreBandM;
    n++;
  }
  return n;
}, over);
const hide = (which) => g.page.evaluate((which) => {
  const R = window.__ENGINE.renderer; window.__R5_HID = []; let n = 0;
  R.scene.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh) || !o.visible) return;
    const nm = o.name || '';
    const isStrip = /^water:shoreline:/.test(nm), isPlane = /^water:/.test(nm) && !isStrip;
    if (!(which === 'all' ? (isStrip || isPlane) : which === 'strip' ? isStrip : isPlane)) return;
    window.__R5_HID.push(o); o.visible = false; n++;
  });
  return n;
}, which);
const unhide = () => g.page.evaluate(() => { for (const o of (window.__R5_HID || [])) o.visible = true; window.__R5_HID = []; });

let commit = 'unknown';
try { commit = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim(); } catch (e) { /* clone */ }

const out = {
  tool: 'f7-r5-sweep', roadmap_item: 'F7', generated: new Date().toISOString(), commit, seed: SEED,
  site: SITE, region_from_census: censusRow.region_actual, region_k: censusRow.region_k,
  stand_verification: standCheck,
  time_of_day: TIME, canvas: [CW, CH], mode: MODE, frozen_phase: MODE === 'motion' ? 'LIVE — not frozen' : FROZEN_PHASE,
  interleaved: INTERLEAVE, arm_order: ORDER,
  mask_policy: {
    pinned: true, mask_arm: BASE_ARM, thresholds: MASK_THRESHOLDS,
    why: 'HAZARDS §25 / RI-VIS03 M12a closing paragraph — one mask per pose, from the named baseline arm, every arm scored through it.',
    and_the_drift: 'HAZARDS §25a — the baseline is ALSO re-captured before and after every arm, so each arm is read against flanking baselines one interval away instead of one baseline eight intervals away. The baseline\'s own spread across its repeated captures is the drift band published beside every number.',
  },
  declared_pose_set: {
    rule: 'RI-VIS03 M12a: >= 4 poses >= 90 deg apart, declared before measuring, every pose on its own line, NO MEAN OVER POSES, a band met only at the WORST pose, >= 1 water_edge pose with a real boundary.',
    bearings_deg: [45, 135, 225, 315],
    targets_from: path.relative(REPO, CENSUS_PATH),
    targets: censusRow.declared_pose_targets,
  },
  head_expression_asserted: asserted,
  refuses_to_measure_if: 'the r4 shore-band block is not verbatim in game/src/render/water.js',
  gpu_state_before: null, phase_freeze: null,
  poses: {}, motion: {}, supersample: {}, null_calibration: null, pageErrors: [],
};
g.page.on('pageerror', (e) => out.pageErrors.push(String(e.message || e)));
const write = () => fs.writeFileSync(path.join(OUT, 'sweep.json'), JSON.stringify(out, null, 2));
write();
if (!asserted.r4_shore_band_block) { console.error('SHORE BAND BLOCK NOT IN water.js — refusing to measure'); await g.close(); process.exit(3); }

out.phase_freeze = MODE === 'motion' ? await collectMats() : await freezePhase(FROZEN_PHASE);
await step(6);
out.gpu_state_before = await gpuState();
write();
console.log('gpu:', JSON.stringify(out.gpu_state_before.distinct));

const maskStore = new Map();
function maskFrom(png, hiddenPng, thr) {
  const N = png.width * png.height, m = new Uint8Array(N);
  let n = 0;
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const d = Math.abs(png.data[p] - hiddenPng.data[p]) + Math.abs(png.data[p + 1] - hiddenPng.data[p + 1]) + Math.abs(png.data[p + 2] - hiddenPng.data[p + 2]);
    if (d > thr) { m[i] = 1; n++; }
  }
  return { m, n };
}
async function applyArm(armId) {
  const S = SHADER_ARMS();
  if (S[armId]) {
    await setUniforms({});
    const res = await applyShaderArm(armId, S[armId]);
    await step(6);
    const n = await editCount();
    return { shader: true, edits_applied: n, edits_expected: res.edits_expected, materials: res.materials };
  }
  await restoreShader(); await setUniforms(UNIFORM_ARMS[armId] || {}); await step(6);
  return { shader: false, uniforms: UNIFORM_ARMS[armId] || {} };
}
const clearArm = async () => { await restoreShader(); await setUniforms({}); await step(6); };

async function captureAt(poseId, tag, hideWhat = null) {
  await POSES[poseId]();
  const n = hideWhat ? await hide(hideWhat) : 0;
  await step(STEP_F);
  const buf = await shot(tag);
  if (hideWhat) { await unhide(); }
  return Object.assign(buf, { meshes_hidden: n });
}

/** Score ONE captured frame against the pinned mask. `baseline` supplies L_base and L_hidden for
 * `presence`; when it is null (the baseline's own first capture) presence is deferred. */
function scoreFrame(png, store, baselineLuma) {
  const byT = {};
  for (const thr of MASK_THRESHOLDS) {
    const pin = store.pins[thr];
    const own = maskFrom(png, store.hiddenPng, thr);
    const m12 = V.M12(V.prepare(png), pin.mask, { sequence: [] });
    const ml = maskedLuma(png, pin.mask);
    const LH = store.hiddenLuma[thr];
    const LB = baselineLuma ? baselineLuma[thr] : null;
    byT[thr] = {
      pinned_mask_px: pin.px,
      own_mask_px: own.n,
      own_mask_delta_pct: pin.px ? +(100 * (own.n - pin.px) / pin.px).toFixed(2) : null,
      ...ml,
      L_hidden: +LH.toFixed(3),
      L_baseline_local: LB === null ? null : +LB.toFixed(3),
      // THE STANDING MEASURE. 0% = the frame with every water mesh hidden; 100% = the baseline arm
      // captured immediately either side of this one. Threshold-independent to 0.59 pp, measured.
      presence_pct: (LB === null || Math.abs(LB - LH) < 1e-6) ? null : +(100 * (ml.mean_luma - LH) / (LB - LH)).toFixed(2),
      m12: Object.fromEntries(Object.entries(m12).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(5) : v])),
      shore: shoreProfile(png, pin.mask, pin.dist_closed),
      shore_raw: shoreProfile(png, pin.mask, pin.dist_raw),
      close_radius_px: pin.close_radius_px, close_moved_px: pin.close_moved_px,
    };
  }
  return byT;
}
const lumaByThreshold = (png, store) => Object.fromEntries(MASK_THRESHOLDS.map((t) => [t, maskedLuma(png, store.pins[t].mask).mean_luma]));

async function preparePose(poseId) {
  const meta = await POSES[poseId]();
  await step(STEP_F);
  const rec = { pose: poseId, ...meta, water_edge_verified: null };
  if (!meta.ok) { rec.void = true; return rec; }
  if (meta.kind === 'water_edge' && meta.target) {
    const [tx, tz] = meta.target.cell_centre;
    const wy = (meta.target.water_y === null || meta.target.water_y === undefined) ? meta.target.ground_y : meta.target.water_y;
    const pr = await project(tx, wy, tz);
    rec.water_edge_verified = { projectPoint: pr, on_screen: !!(pr && pr.on_screen && pr.in_front) };
  }
  await applyArm(BASE_ARM);
  const hiddenBuf = await captureAt(poseId, `${poseId}--water-hidden`, 'all');
  const pinBuf = await captureAt(poseId, `${poseId}--PIN-${BASE_ARM}`);
  await clearArm();
  const hiddenPng = readPng(hiddenBuf), pinPng = readPng(pinBuf);
  const pins = {};
  for (const thr of MASK_THRESHOLDS) {
    const { m, n } = maskFrom(pinPng, hiddenPng, thr);
    const { closed, moved } = closeMask(m, pinPng.width, pinPng.height, CLOSE_R);
    pins[thr] = { mask: m, px: n, dist_raw: distanceFromLand(m, pinPng.width, pinPng.height), dist_closed: distanceFromLand(closed, pinPng.width, pinPng.height), close_radius_px: CLOSE_R, close_moved_px: moved };
  }
  const store = { hiddenPng, pins, W: pinPng.width, H: pinPng.height, hiddenLuma: {} };
  for (const thr of MASK_THRESHOLDS) store.hiddenLuma[thr] = maskedLuma(hiddenPng, pins[thr].mask).mean_luma;
  rec.meshes_hidden = hiddenBuf.meshes_hidden;
  rec.pinned_mask_px = Object.fromEntries(MASK_THRESHOLDS.map((t) => [t, pins[t].px]));
  rec.hidden_frame_luma = Object.fromEntries(MASK_THRESHOLDS.map((t) => [t, +store.hiddenLuma[t].toFixed(3)]));
  rec.mask_closing = Object.fromEntries(MASK_THRESHOLDS.map((t) => [t, { radius_px: CLOSE_R, pixels_moved: pins[t].close_moved_px, pct_of_mask: pins[t].px ? +(100 * pins[t].close_moved_px / pins[t].px).toFixed(2) : null }]));
  maskStore.set(poseId, store);
  return rec;
}

/* ---- 1. ARMS, INTERLEAVED ------------------------------------------------------------------- */
if (MODE === 'arms') {
  const DEFAULT = ['r3', ...BANDS.map((b) => `band-${b.toFixed(2)}`), 'fixed', 'no-shorefade'].join(',');
  let ARMS = String(args.arms || DEFAULT).split(',').map((s) => s.trim()).filter(Boolean);
  if (ORDER === 'reverse') ARMS = ARMS.slice().reverse();
  const POSE_LIST = String(args.poses || 'edge-b225').split(',').map((s) => s.trim()).filter(Boolean);
  for (const p of POSE_LIST) if (!POSES[p]) { console.error(`unknown pose ${p}`); await g.close(); process.exit(2); }

  for (const poseId of POSE_LIST) {
    const rec = await preparePose(poseId);
    out.poses[poseId] = { ...rec, arms: {}, baseline_captures: [], baseline_drift: null };
    write();
    if (rec.void) { console.log(`${poseId}: VOID — ${rec.why}`); continue; }
    const store = maskStore.get(poseId);
    let ord = 0;
    const baseRows = [];
    /** Capture the UNCHANGED baseline arm. Its own repeated rows ARE the drift band. */
    const captureBaseline = async () => {
      await applyArm(BASE_ARM);
      const buf = await captureAt(poseId, `${poseId}--BASE-o${ord}`);
      const png = readPng(buf);
      const lum = lumaByThreshold(png, store);
      const row = { ordinal: ord, frame: `frames/${poseId}--BASE-o${ord}.png`, by_threshold: scoreFrame(png, store, lum) };
      // presence of the baseline against ITSELF is 100 by construction and is not evidence; what
      // matters is its luma and width moving across ordinals, which is the drift.
      baseRows.push({ ordinal: ord, luma: lum, row });
      out.poses[poseId].baseline_captures.push(row);
      ord++; await clearArm(); write();
      console.log(`  BASE o${row.ordinal}: ` + MASK_THRESHOLDS.map((t) => `thr${t} luma=${row.by_threshold[t].mean_luma} w=${row.by_threshold[t].shore && row.by_threshold[t].shore.gradient_width_px}`).join(' | '));
      return lum;
    };
    let prevBase = await captureBaseline();
    for (const armId of ARMS) {
      const applied = await applyArm(armId);
      const buf = await captureAt(poseId, `${poseId}--${armId}-o${ord}`);
      const png = readPng(buf);
      const myOrd = ord; ord++;
      await clearArm();
      const nextBase = INTERLEAVE ? await captureBaseline() : prevBase;
      // THE FLANKED BASELINE: the mean of the baseline captured immediately before and immediately
      // after this arm. Monotonic drift over the interval cancels to first order.
      const flanked = Object.fromEntries(MASK_THRESHOLDS.map((t) => [t, (prevBase[t] + nextBase[t]) / 2]));
      const row = { arm: armId, ordinal: myOrd, frame: `frames/${poseId}--${armId}-o${myOrd}.png`, ...applied,
        baseline_before: Object.fromEntries(MASK_THRESHOLDS.map((t) => [t, +prevBase[t].toFixed(3)])),
        baseline_after: Object.fromEntries(MASK_THRESHOLDS.map((t) => [t, +nextBase[t].toFixed(3)])),
        by_threshold: scoreFrame(png, store, flanked) };
      if (applied.shader && !applied.edits_applied) row.VACUOUS = `FAIL — the ${armId} edit matched nothing in the compiled shader. NOT a result.`;
      out.poses[poseId].arms[armId] = row; write();
      console.log(`${poseId} ${armId} o${myOrd}: ` + MASK_THRESHOLDS.map((t) => { const b = row.by_threshold[t]; return `thr${t} pres=${b.presence_pct}% w=${b.shore && b.shore.gradient_width_px} luma=${b.mean_luma} maskΔ=${b.own_mask_delta_pct}%`; }).join(' | ') + (row.VACUOUS ? '  VACUOUS' : ''));
      prevBase = nextBase;
    }
    // THE DRIFT BAND, at the ordinals the arms actually span. Publish beside every number.
    out.poses[poseId].baseline_drift = Object.fromEntries(MASK_THRESHOLDS.map((t) => {
      const l = baseRows.map((b) => b.row.by_threshold[t].mean_luma);
      const w = baseRows.map((b) => b.row.by_threshold[t].shore && b.row.by_threshold[t].shore.gradient_width_px);
      const wr = baseRows.map((b) => b.row.by_threshold[t].shore_raw && b.row.by_threshold[t].shore_raw.gradient_width_px);
      const mk = baseRows.map((b) => b.row.by_threshold[t].own_mask_px);
      const fd = baseRows.map((b) => b.row.by_threshold[t].m12.FresnelDelta);
      const sd = baseRows.map((b) => b.row.by_threshold[t].m12.ShoreDelta);
      const first = baseRows[0] ? baseRows[0].row.by_threshold[t].mean_luma : null;
      const presAsIfArm = baseRows.map((b) => { const LH = store.hiddenLuma[t]; return first === null ? null : +(100 * (b.row.by_threshold[t].mean_luma - LH) / (first - LH)).toFixed(2); });
      return [t, {
        captures: baseRows.length,
        mean_luma: spread(l),
        gradient_width_px_closed: spread(w),
        gradient_width_px_raw: spread(wr),
        own_mask_px: spread(mk),
        own_mask_pct_range: mk.length > 1 ? +(100 * (Math.max(...mk) - Math.min(...mk)) / Math.min(...mk)).toFixed(2) : null,
        FresnelDelta: spread(fd),
        ShoreDelta: spread(sd),
        presence_pct_if_scored_as_an_arm: spread(presAsIfArm),
        how_to_read: 'These are repeated captures of the IDENTICAL unchanged arm, spread across the same ordinals the arms occupy. Any arm result inside this band is nothing. `presence_pct_if_scored_as_an_arm` is the drift expressed in the round\'s headline unit: it is what an arm that changed NOTHING would score.',
      }];
    }));
    write();
  }
}

/* ---- 2. MOTION — orbit and temporal, phase LIVE --------------------------------------------- */
if (MODE === 'motion') {
  const POSE_LIST = String(args.poses || 'edge-b135').split(',').map((s) => s.trim()).filter(Boolean);
  const ARMS = String(args.arms || 'fixed').split(',').map((s) => s.trim()).filter(Boolean);
  for (const poseId of POSE_LIST) {
    const bearing = Number((poseId.match(/edge-b(\d+)/) || [])[1]);
    const rec = { pose: poseId, bearing_deg: bearing, arms: {} };
    for (const armId of ARMS) {
      const applied = await applyArm(armId);
      // (a) THE ORBIT. The camera circles the declared waterline target. Phase is live, so the
      //     water is moving as well as the camera. Every frame is written out.
      const orbitFrames = [];
      for (let i = 0; i < ORBIT_BEARINGS; i++) {
        const around = bearing + (360 * i / ORBIT_BEARINGS);
        const o = await orbitEdge(bearing, around % 360);
        if (!o.ok) { orbitFrames.push({ around_deg: around % 360, void: o.why }); continue; }
        await step(6);
        const tag = `motion-orbit--${armId}--b${String(Math.round(around % 360)).padStart(3, '0')}`;
        await shot(tag);
        orbitFrames.push({ around_deg: +(around % 360).toFixed(1), frame: `frames/${tag}.png` });
      }
      // (b) THE STATIONARY SEQUENCE — RI-VIS03 M12 `TemporalVar`, a fifth-round debt. The camera
      //     does not move, the water phase does. TemporalVar is the stddev over the sequence of
      //     mean(Yp) inside the water mask; the mask here is built from this pose's own
      //     water-hidden frame at threshold 10 so it is not inherited from another run.
      await POSES[poseId]();
      await step(STEP_F);
      const nHidden = await hide('all'); await step(4);
      const hiddenBuf = await shot(`motion-hidden--${armId}`); await unhide(); await step(4);
      const hiddenPng = readPng(hiddenBuf);
      const firstBuf = await shot(`motion-temporal--${armId}--f000`);
      const firstPng = readPng(firstBuf);
      const { m, n } = maskFrom(firstPng, hiddenPng, 10);
      const series = [meanYp(firstPng, m)];
      const tFrames = [`frames/motion-temporal--${armId}--f000.png`];
      for (let f = 1; f < MOTION_FRAMES; f++) {
        await step(1);
        const tag = `motion-temporal--${armId}--f${String(f).padStart(3, '0')}`;
        const b = await shot(tag);
        series.push(meanYp(readPng(b), m));
        tFrames.push(`frames/${tag}.png`);
      }
      const mu = series.reduce((a, b) => a + b, 0) / series.length;
      const sd = Math.sqrt(series.reduce((a, b) => a + (b - mu) ** 2, 0) / series.length);
      rec.arms[armId] = {
        ...applied,
        orbit: { bearings: ORBIT_BEARINGS, radius_m: 11, height_m: 3.0, frames: orbitFrames,
          why: 'CLAUDE.md character directive: stills from one angle are not evidence. The camera circles the declared waterline cell with the water phase LIVE.' },
        temporal: {
          frames: series.length, mask_px: n, meshes_hidden: nHidden,
          mean_Yp_series: series.map((v) => +v.toFixed(6)),
          TemporalVar: +sd.toFixed(6), band: '>= 0.002', fail_below: 0.0005,
          verdict: sd >= 0.002 ? 'PASS' : (sd < 0.0005 ? 'HARD FAIL — water is static' : 'FAIL (between the band and the hard-fail floor)'),
          frame_list: tFrames,
          method: 'stddev over the sequence of mean(Yp) inside the water mask, phase LIVE, camera stationary. RI-VIS03 M12 asks for 30 stationary frames; this run took ' + series.length + '.',
        },
      };
      await clearArm();
      console.log(`motion ${poseId} ${armId}: TemporalVar=${rec.arms[armId].temporal.TemporalVar} (${rec.arms[armId].temporal.verdict}) orbit=${orbitFrames.filter((f) => f.frame).length}/${ORBIT_BEARINGS} frames`);
      write();
    }
    out.motion[poseId] = rec;
    write();
  }
}

/* ---- 3. SUPERSAMPLE — RI-VIS04 §8, a fourth-round debt --------------------------------------- */
if (MODE === 'supersample') {
  const POSE_LIST = String(args.poses || 'edge-b135').split(',').map((s) => s.trim()).filter(Boolean);
  const ARMS = String(args.arms || 'fixed').split(',').map((s) => s.trim()).filter(Boolean);
  /** box-downsample a 2Nx2M frame to NxM — four samples per output pixel. */
  const downsample2 = (png) => {
    const W = png.width >> 1, H = png.height >> 1;
    const o = new PNG({ width: W, height: H });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      for (let c = 0; c < 4; c++) {
        const a = png.data[((2 * y) * png.width + 2 * x) * 4 + c], b = png.data[((2 * y) * png.width + 2 * x + 1) * 4 + c];
        const d = png.data[((2 * y + 1) * png.width + 2 * x) * 4 + c], e = png.data[((2 * y + 1) * png.width + 2 * x + 1) * 4 + c];
        o.data[(y * W + x) * 4 + c] = Math.round((a + b + d + e) / 4);
      }
    }
    return o;
  };
  const hf = (png, m) => {
    const o = lumOf(png), W = o.w, H = o.h; let a = 0, na = 0, b = 0, nb = 0;
    for (let r = 0; r < H; r++) for (let c = 0; c < W - 2; c++) {
      const i = r * W + c;
      if (m[i] && m[i + 1]) { a += Math.abs(o.y[i] - o.y[i + 1]); na++; }
      if (m[i] && m[i + 2]) { b += Math.abs(o.y[i] - o.y[i + 2]); nb++; }
    }
    return na && nb ? { mean_abs_dY_adjacent: +(a / na).toFixed(4), mean_abs_dY_two_apart: +(b / nb).toFixed(4), stipple_ratio: +((a / na) / (b / nb)).toFixed(4) } : null;
  };
  for (const poseId of POSE_LIST) {
    const rows = {};
    for (const armId of ARMS) {
      await applyArm(armId);
      await setCanvas(CW, CH); await POSES[poseId](); await step(STEP_F);
      const n1 = await hide('all'); await step(4); const h1 = readPng(await shot(`ss-1x-hidden--${armId}`)); await unhide(); await step(4);
      const p1 = readPng(await shot(`ss-1x--${armId}`));
      const { m: m1 } = maskFrom(p1, h1, 10);
      await setCanvas(CW * 2, CH * 2); await POSES[poseId](); await step(STEP_F);
      const n2 = await hide('all'); await step(4); const h2r = readPng(await shot(`ss-2x-hidden--${armId}`)); await unhide(); await step(4);
      const p2 = readPng(await shot(`ss-2x--${armId}`));
      const p2d = downsample2(p2), h2d = downsample2(h2r);
      const dsPath = path.join(OUT, 'frames', `ss-2x-downsampled--${armId}.png`);
      fs.writeFileSync(dsPath, PNG.sync.write(p2d));
      const { m: m2 } = maskFrom(p2d, h2d, 10);
      const a = hf(p1, m1), b = hf(p2d, m2);
      rows[armId] = {
        native_1x: a, supersampled_2x_downsampled: b,
        mask_px: { native: m1.reduce((s, v) => s + v, 0), supersampled: m2.reduce((s, v) => s + v, 0) },
        hf_energy_surviving_pct: (a && b) ? +(100 * b.mean_abs_dY_adjacent / a.mean_abs_dY_adjacent).toFixed(2) : null,
        how_to_read: 'RI-VIS04 §8. Detail that is REAL surface structure survives supersampling; detail that is ALIASING of a procedural frequency past the pixel Nyquist limit collapses when four samples are averaged into one. A high NormalEnergy that vanishes here was never ripple detail. The 1x and 2x masks are each built from their OWN water-hidden frame so the two are not compared through one another\'s boundary.',
        meshes_hidden: { native: n1, supersampled: n2 },
      };
      await clearArm();
      console.log(`supersample ${poseId} ${armId}: 1x adj=${a && a.mean_abs_dY_adjacent} -> 2x-down adj=${b && b.mean_abs_dY_adjacent} (${rows[armId].hf_energy_surviving_pct}% survives)`);
      write();
    }
    out.supersample[poseId] = rows;
    await setCanvas(CW, CH);
    write();
  }
}

out.gpu_state_after = await gpuState();
write();
await g.close();
console.log(`\nwrote ${path.join(OUT, 'sweep.json')}`);
