#!/usr/bin/env node
/**
 * f7-r2-critic-phase.mjs — F7 ROUND 2 CRITIC. THE INSTRUMENT'S REAL BAND, AND AN UNCONFOUNDED ARM EFFECT.
 *
 * WHY THIS TOOL EXISTS. `f7-r2-sweep.mjs` captures its arms SEQUENTIALLY, advancing the simulation
 * with `stepFrames` between every capture and never resetting the water phase. So an arm's capture
 * ORDINAL fixes the ripple phase it is measured at, and two arms at different ordinals differ by
 * BOTH the shader term under test AND the phase. Three facts force the point:
 *
 *   - the round-2 `fixed` arm is BIT-IDENTICAL between two separate processes at two different
 *     commits (vista1 and vista2: FresnelDelta -0.01381, ShoreDelta 0.01222, luma 74.684) because
 *     it is the 3rd arm in both runs;
 *   - the SAME untouched shader captured twice in ONE process at different ordinals disagrees
 *     (vista1 `fixed` 3rd: FD -0.01381; `nothing-restore-control` 5th: FD +0.00598);
 *   - so the builder's "run-to-run spread of 0.049" is not stochastic instrument noise. It is a
 *     deterministic function of where in the run the capture happened.
 *
 * The consequence is that the round's headline number — clause (b)'s within-process
 * prefix -> fixed delta of +0.05311 — is CONFOUNDED, because prefix and fixed sit at different
 * ordinals. This tool separates the two effects:
 *
 *   REPLICATE SERIES  the untouched scene captured R times at one pose with the same phase advance
 *                     between captures and NO shader change at all. Every number that moves here
 *                     moves for a reason that is not the fix. This IS the band S61 demands be
 *                     measured per screen and published with the score.
 *
 *   INTERLEAVED PAIRS the two arms captured alternately, R times each, with the ORDER SWAPPED on
 *                     every other replicate (fixed,prefix / prefix,fixed / ...). Averaged over
 *                     replicates the phase drift cancels to first order, and the paired per-replicate
 *                     delta can be reported with a spread instead of as a single number.
 *
 * The ruler is the corpus's own `tools/metrics/lib/vis03.mjs` M12, not a reimplementation.
 *
 *   node tools/visual/f7-r2-critic-phase.mjs --out <dir> --pose c-vista-11-d26 --reps 4 --mode both
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
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/f7-r2-critic/phase');
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
const CROP = String(args.crop || '200,760,60,480').split(',').map(Number);
const REPS = Number(args.reps || 4);
const MODE = String(args.mode || 'both');           // replicate | pairs | both
const POSE_ID = String(args.pose || 'c-vista-11-d26');
const STEP = Number(args.step || 8);                 // phase advance between captures, as the sweep uses
const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
const V = await import(path.join(REPO, 'tools/metrics/lib/vis03.mjs'));

const readPng = (b) => PNG.sync.read(b);
function lumOf(png) {
  const y = new Float32Array(png.width * png.height);
  for (let i = 0, j = 0; i < png.data.length; i += 4, j++) y[j] = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  return { y, w: png.width, h: png.height };
}
const inCrop = (i, w, [x0, x1, y0, y1]) => { const x = i % w, y = (i / w) | 0; return x >= x0 && x < x1 && y >= y0 && y < y1; };

/* the r1 critic's masked lane estimator, same shape as the sweep's, so the numbers are comparable */
function bandpassRows(o) {
  const { y, w, h } = o, hp = new Float32Array(y.length);
  const K = 9, half = (K - 1) / 2;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      let s = 0, n = 0;
      for (let k = -half; k <= half; k++) { const cc = c + k; if (cc < 0 || cc >= w) continue; s += y[r * w + cc]; n++; }
      hp[r * w + c] = y[r * w + c] - s / n;
    }
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
  'e-eye-yaw090': () => pose(90, -8, 7),
  'h-grazing-2': () => pose(45, -2, 12),
};
/* THE TWO SHOTS NOBODY HAS TAKEN. The build's own overturn condition for the ShoreDelta
 * regression is "a shoreline close-up showing it is visible rather than metric-only", and it says
 * it did not take that shot. CLAUDE.md's character directive and the owner's 2026-08-14 ruling both
 * say a still from one angle is how a defect gets declared fixed while broken — so eye level is
 * orbited, not photographed once. */
const LOOK_POSES = [
  ...[0, 45, 90, 135, 180, 225, 270, 315].map((y) => ([`orbit-eye-yaw${String(y).padStart(3, '0')}`, () => pose(y, -8, 7)])),
  ['shore-close-a', () => pose(Number(site.camera.yaw_deg ?? 90), -20, 5)],
  ['shore-close-b', () => pose(Number(site.camera.yaw_deg ?? 90) + 90, -18, 6)],
  ['shore-close-c', () => pose(Number(site.camera.yaw_deg ?? 90) + 180, -14, 8)],
];
if (!POSES[POSE_ID]) { console.error(`unknown pose ${POSE_ID}`); await g.close(); process.exit(2); }

const applyEdits = (armId, edits) => g.page.evaluate(({ armId, edits }) => {
  const R = window.__ENGINE.renderer, mats = new Set();
  R.scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m && m.userData && m.userData.waterUniforms) mats.add(m); });
  window.__R2_EDITS = 0; window.__R2_MATS = mats;
  for (const m of mats) {
    if (!m.__r2OrigOBC) { m.__r2OrigOBC = m.onBeforeCompile; m.__r2OrigKey = m.customProgramCacheKey; }
    m.onBeforeCompile = function (shader, renderer) {
      m.__r2OrigOBC.call(this, shader, renderer);
      for (const [needle, rep] of edits) if (shader.fragmentShader.includes(needle)) { shader.fragmentShader = shader.fragmentShader.split(needle).join(rep); window.__R2_EDITS++; }
    };
    m.customProgramCacheKey = () => `f7-r2c:${armId}`; m.needsUpdate = true;
  }
  return { materials: mats.size };
}, { armId, edits });
const editCount = () => g.page.evaluate(() => window.__R2_EDITS || 0);
const restoreEdits = () => g.page.evaluate(() => {
  for (const m of (window.__R2_MATS || [])) if (m.__r2OrigOBC) { m.onBeforeCompile = m.__r2OrigOBC; m.customProgramCacheKey = m.__r2OrigKey; m.needsUpdate = true; }
  window.__R2_MATS = new Set();
});
const hideClass = (inc, exc) => g.page.evaluate(({ inc, exc }) => {
  const R = window.__ENGINE.renderer, I = new RegExp(inc), E = exc ? new RegExp(exc) : null;
  window.__R2_HID = []; let n = 0;
  R.scene.traverse((o) => { if (!(o.isMesh || o.isInstancedMesh) || !o.visible) return; const nm = o.name || ''; if (!I.test(nm) || (E && E.test(nm))) return; window.__R2_HID.push(o); o.visible = false; n++; });
  return n;
}, { inc, exc: exc || null });
const unhide = () => g.page.evaluate(() => { for (const o of (window.__R2_HID || [])) o.visible = true; window.__R2_HID = []; });

/* the two shader expressions, asserted against the live file exactly as the build's tool does */
const HEAD_W = 'vec3 esSurface=mix(esDepth,esReflection,esRefl*uWaterReflectionStrength);';
const R1_BLOCK_HEAD = `float esF0=.02;
        float esRefl=esF0+(1.0-esF0)*pow(1.0-esView,5.0);
        esRefl=max(esRefl,smoothstep(10.0,52.0,length(vViewPosition))*.72*(1.0-esView));`;
const R1_BLOCK_R1 = `float esFresnel=pow(1.0-esView,2.2);
        float esRefl=.25+max(esFresnel,smoothstep(10.0,52.0,length(vViewPosition))*.72*(1.0-esView))*.50;`;
const waterSrc = fs.readFileSync(path.join(REPO, 'game/src/render/water.js'), 'utf8');
const asserted = waterSrc.includes(HEAD_W) && waterSrc.includes('float esF0=.02;');

let commit = 'unknown';
try { commit = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim(); } catch (e) { /* real clone */ }

const out = {
  tool: 'f7-r2-critic-phase', generated: new Date().toISOString(), commit, seed: SEED,
  site: SITE, pose: POSE_ID, canvas: [CW, CH], crop: CROP, reps: REPS, mode: MODE, step_between_captures: STEP,
  head_expression_asserted: asserted ? 'PASS — game/src/render/water.js carries the round-2 weight verbatim' : 'FAIL — the round-2 weight is NOT in the file; every arm below is a fiction',
  what_this_separates: 'the replicate series moves the water phase and NOTHING else; the interleaved pairs swap arm order every other replicate so phase drift cancels to first order',
  replicate_series: [], interleaved_pairs: [], pageErrors: [],
};
g.page.on('pageerror', (e) => out.pageErrors.push(String(e.message || e)));
const write = () => fs.writeFileSync(path.join(OUT, 'phase.json'), JSON.stringify(out, null, 2));
write();
if (!asserted) { console.error('HEAD EXPRESSION NOT PRESENT — refusing to measure'); await g.close(); process.exit(3); }

/* the WATER_MASK, captured once at this pose from the water-hidden frame (M12's own first choice) */
await POSES[POSE_ID](); await step(STEP);
const nHidden = await hideClass('^water', null);
await step(4);
const hidBuf = await shot(`water-hidden-${POSE_ID}`);
await unhide(); await step(4);
const hidPng = readPng(hidBuf);
out.mask = { meshes_hidden: nHidden, from: `frames/water-hidden-${POSE_ID}.png` };

function maskFrom(basePng) {
  const N = basePng.width * basePng.height, m = new Uint8Array(N); let n = 0;
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const d = Math.abs(basePng.data[p] - hidPng.data[p]) + Math.abs(basePng.data[p + 1] - hidPng.data[p + 1]) + Math.abs(basePng.data[p + 2] - hidPng.data[p + 2]);
    if (d > 6) { m[i] = 1; n++; }
  }
  return { m, n };
}
async function measure(name) {
  await POSES[POSE_ID](); await step(STEP);
  const buf = await shot(name);
  const png = readPng(buf);
  const { m, n } = maskFrom(png);
  const pl = V.prepare(png);
  const m12 = V.M12(pl, m, { sequence: [] });
  return {
    frame: `frames/${name}.png`, water_mask_px: n, water_mask_pct: +(100 * n / m.length).toFixed(2),
    m12: Object.fromEntries(Object.entries(m12).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(5) : v])),
    masked: maskedStats(png, m, CROP),
  };
}

/* ------------------------------------------------------------- 1. THE REPLICATE SERIES ------ */
if (MODE === 'replicate' || MODE === 'both') {
  for (let r = 0; r < REPS; r++) {
    const row = await measure(`rep-${POSE_ID}-${r}`);
    row.replicate = r; row.arm = 'HEAD, untouched — no shader edit of any kind';
    out.replicate_series.push(row); write();
    console.log(`rep ${r}: FD=${row.m12.FresnelDelta} SD=${row.m12.ShoreDelta} luma=${row.masked && row.masked.mean_luma} lanePow=${row.masked && row.masked.lane_power} aniso=${row.masked && row.masked.lane_aniso}`);
  }
}

/* ------------------------------------------------------------- 2. THE INTERLEAVED PAIRS ----- */
if (MODE === 'pairs' || MODE === 'both') {
  for (let r = 0; r < REPS; r++) {
    const order = (r % 2 === 0) ? ['fixed', 'prefix'] : ['prefix', 'fixed'];
    const pair = { replicate: r, order: order.join(' then '), arms: {} };
    for (const arm of order) {
      if (arm === 'prefix') {
        const res = await applyEdits('prefix', [[R1_BLOCK_HEAD, R1_BLOCK_R1]]);
        await step(6);
        const n = await editCount();
        if (!n) { pair.arms[arm] = { VACUOUS: 'FAIL — the prefix edit matched nothing. Not a result.' }; continue; }
        pair.edits_applied = n; pair.materials = res.materials;
      } else {
        await restoreEdits(); await step(6);
      }
      pair.arms[arm] = await measure(`pair${r}-${arm}-${POSE_ID}`);
    }
    await restoreEdits(); await step(6);
    const f = pair.arms.fixed, p = pair.arms.prefix;
    if (f && p && f.m12 && p.m12) {
      pair.delta_prefix_to_fixed = {
        FresnelDelta: +(f.m12.FresnelDelta - p.m12.FresnelDelta).toFixed(5),
        ShoreDelta: +(f.m12.ShoreDelta - p.m12.ShoreDelta).toFixed(5),
        mean_luma_pct: p.masked ? +(100 * (f.masked.mean_luma - p.masked.mean_luma) / p.masked.mean_luma).toFixed(2) : null,
        lane_power_pct: p.masked ? +(100 * (f.masked.lane_power - p.masked.lane_power) / p.masked.lane_power).toFixed(2) : null,
        lane_aniso: p.masked ? +(f.masked.lane_aniso - p.masked.lane_aniso).toFixed(2) : null,
      };
    }
    out.interleaved_pairs.push(pair); write();
    console.log(`pair ${r} (${pair.order}): dFD=${pair.delta_prefix_to_fixed && pair.delta_prefix_to_fixed.FresnelDelta} dSD=${pair.delta_prefix_to_fixed && pair.delta_prefix_to_fixed.ShoreDelta} dLuma%=${pair.delta_prefix_to_fixed && pair.delta_prefix_to_fixed.mean_luma_pct}`);
  }
}

/* --------------------------------- 2b. THE ORBIT AND THE SHORELINE CLOSE-UP ----------------- */
if (MODE === 'look') {
  out.look = { what: 'both arms at eight eye-level orbit bearings and three shoreline close-ups, so the round\'s central visual claim and the ShoreDelta regression can be SEEN rather than inferred', poses: {} };
  for (const [id, run] of LOOK_POSES) {
    const cell = { arms: {} };
    // mask for this pose, captured once from the untouched scene
    await run(); await step(STEP);
    const nH = await hideClass('^water', null); await step(4);
    const hb = await shot(`look-${id}-water-hidden`); await unhide(); await step(4);
    const hp = readPng(hb);
    const maskFor = (bp) => { const N = bp.width * bp.height, m = new Uint8Array(N); let n = 0; for (let i = 0, p = 0; i < N; i++, p += 4) { const d = Math.abs(bp.data[p] - hp.data[p]) + Math.abs(bp.data[p + 1] - hp.data[p + 1]) + Math.abs(bp.data[p + 2] - hp.data[p + 2]); if (d > 6) { m[i] = 1; n++; } } return { m, n }; };
    cell.meshes_hidden = nH;
    for (const arm of ['fixed', 'prefix']) {
      if (arm === 'prefix') { await applyEdits('prefix', [[R1_BLOCK_HEAD, R1_BLOCK_R1]]); await step(6); const n = await editCount(); if (!n) { cell.arms[arm] = { VACUOUS: 'the prefix edit matched nothing' }; continue; } cell.edits_applied = n; }
      else { await restoreEdits(); await step(6); }
      await run(); await step(STEP);
      const buf = await shot(`look-${id}-${arm}`);
      const png = readPng(buf); const { m, n } = maskFor(png);
      const m12 = V.M12(V.prepare(png), m, { sequence: [] });
      cell.arms[arm] = {
        frame: `frames/look-${id}-${arm}.png`, water_mask_px: n, water_mask_pct: +(100 * n / m.length).toFixed(2),
        m12: Object.fromEntries(Object.entries(m12).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(5) : v])),
        masked: maskedStats(png, m, [0, CW, 0, CH]),
      };
    }
    await restoreEdits(); await step(6);
    const f = cell.arms.fixed, p = cell.arms.prefix;
    if (f && p && f.masked && p.masked) cell.delta = {
      mean_luma_pct: +(100 * (f.masked.mean_luma - p.masked.mean_luma) / p.masked.mean_luma).toFixed(2),
      band_contrast_pct: +(100 * (f.masked.band_contrast - p.masked.band_contrast) / p.masked.band_contrast).toFixed(2),
      ShoreDelta: +(f.m12.ShoreDelta - p.m12.ShoreDelta).toFixed(5),
      FresnelDelta: +(f.m12.FresnelDelta - p.m12.FresnelDelta).toFixed(5),
    };
    out.look.poses[id] = cell; write();
    console.log(`look ${id}: dLuma%=${cell.delta && cell.delta.mean_luma_pct} dSD=${cell.delta && cell.delta.ShoreDelta}`);
  }
}

/* ------------------------------------------------------------- 3. THE BANDS ------------------ */
const spread = (vals) => {
  const v = vals.filter((x) => typeof x === 'number' && Number.isFinite(x));
  if (v.length < 2) return { n: v.length, note: 'fewer than two readings; no band' };
  const mn = Math.min(...v), mx = Math.max(...v), mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
  return { n: v.length, min: +mn.toFixed(5), max: +mx.toFixed(5), range: +(mx - mn).toFixed(5), mean: +mean.toFixed(5), sd: +sd.toFixed(5) };
};
if (out.replicate_series.length) {
  const R = out.replicate_series;
  out.replicate_band = {
    what: 'THE BAND. Same shader, same pose, same process — only the water phase moves. Any acceptance margin smaller than `range` here is unresolved and fails closed (ARBITRATION S61).',
    FresnelDelta: spread(R.map((x) => x.m12.FresnelDelta)),
    ShoreDelta: spread(R.map((x) => x.m12.ShoreDelta)),
    TemporalVar: spread(R.map((x) => x.m12.TemporalVar)),
    mean_luma: spread(R.map((x) => x.masked && x.masked.mean_luma)),
    lane_power: spread(R.map((x) => x.masked && x.masked.lane_power)),
    lane_aniso: spread(R.map((x) => x.masked && x.masked.lane_aniso)),
    lane_power_normalised: spread(R.map((x) => x.masked && x.masked.lane_power_normalised)),
    water_mask_pct: spread(R.map((x) => x.water_mask_pct)),
  };
}
if (out.interleaved_pairs.length) {
  const P = out.interleaved_pairs.filter((x) => x.delta_prefix_to_fixed);
  out.paired_arm_effect = {
    what: 'the prefix -> fixed delta, measured R times with the capture order swapped every other replicate, so the phase drift the sweep confounds into its single number is averaged out and its spread is visible.',
    FresnelDelta: spread(P.map((x) => x.delta_prefix_to_fixed.FresnelDelta)),
    ShoreDelta: spread(P.map((x) => x.delta_prefix_to_fixed.ShoreDelta)),
    mean_luma_pct: spread(P.map((x) => x.delta_prefix_to_fixed.mean_luma_pct)),
    lane_power_pct: spread(P.map((x) => x.delta_prefix_to_fixed.lane_power_pct)),
    lane_aniso: spread(P.map((x) => x.delta_prefix_to_fixed.lane_aniso)),
  };
}
write();
console.log('\nwrote', path.relative(REPO, path.join(OUT, 'phase.json')));
if (out.replicate_band) console.log('BAND FresnelDelta range =', out.replicate_band.FresnelDelta.range, '| mean_luma range =', out.replicate_band.mean_luma.range);
if (out.paired_arm_effect) console.log('PAIRED dFresnelDelta =', JSON.stringify(out.paired_arm_effect.FresnelDelta));
await g.close();
