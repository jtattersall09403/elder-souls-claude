#!/usr/bin/env node
/**
 * f7-r4-sweep.mjs — F7 ROUND 4 BUILDER. ONE PINNED MASK, A DECLARED POSE SET, TWO REGIONS.
 *
 * WHY THIS IS A NEW TOOL AND NOT AN EDIT OF `f7-r3-sweep.mjs`. Two reasons, both checked this
 * turn. (1) `node tools/ownership.mjs --for tools/visual/f7-r3-sweep.mjs` reports it claimed by a
 * live piece (`W1-30V`), so editing it is editing somebody's ruler mid-measurement. (2) HAZARDS
 * §25 — written the night before this round, FROM this round's instrument — says the r3 tool's
 * defect is structural: it derives the water mask SEPARATELY FOR EACH ARM, so an arm that changes
 * the water's alpha changes its own denominator, its own boundary, and every distance measured
 * from that boundary. Round 3 was the first F7 round to touch alpha and round 4 touches it
 * harder, so this is not a nuisance to be normalised away, it is the difference between a
 * measurement and a fiction. Measured consequence on ONE unchanged frame pair: a `FresnelDelta`
 * sign flip (+0.148 -> -0.145 per-arm, +0.148 -> +0.161 pinned) and a spurious `ShoreDelta` pass
 * (0.024 -> 0.093 per-arm, 0.024 -> 0.021 pinned).
 *
 * THE FOUR THINGS THIS TOOL DOES THAT NO F7 TOOL HAS DONE.
 *
 *  1. THE MASK IS PINNED, AND THE TOOL SAYS WHICH ARM IT CAME FROM. One mask per pose, derived
 *     once from the DESIGNATED BASELINE ARM (`--maskArm`, default `prefix` = the round-2 shader),
 *     and every arm at that pose is scored through it. This is the conservative direction: the
 *     fix is scored on the pixels the arm it must beat calls water, so it cannot widen its own
 *     denominator. Each arm's OWN mask is still computed and reported as `own_mask_px` with its
 *     delta against the pin — HAZARDS §25 says a moving mask is a finding to report, not a
 *     nuisance to hide, so it is reported on every row.
 *
 *  2. THE POSE SET IS DECLARED BEFORE MEASURING AND IT IS DERIVED FROM THE WORLD FIELD.
 *     `RI-VIS03` M12a (added by the r3 critic) requires >= 4 poses >= 90 deg apart, declared in
 *     advance, every pose on its own line, NO MEAN OVER POSES, a band met only at the WORST pose,
 *     and at least one `water_edge` pose with a REAL water/land boundary. Three rounds chose
 *     close-ups by eye and the r3 critic opened all three and found no bank in any of them. So
 *     the four bearings here are fixed at exactly 45/135/225/315 — 90 deg apart by construction,
 *     no freedom to shop — and the target on each ray is the nearest WATERLINE CELL found offline
 *     by `f7-r4-shoreline-census.mjs` against the same `WorldField` the engine builds. Each pose
 *     then VERIFIES with the harness's own `projectPoint` that the target landed on screen; a
 *     pose whose target is off-screen or behind the camera is recorded `water_edge_verified:
 *     false` and its shoreline rows are void rather than quietly scored.
 *
 *  3. IT MEASURES THE TRANSPARENCY SORT AGAINST province.js's WET-BANK STRIP. This is the r3
 *     build's own overturn condition #3 and the r3 critic called it "the strongest untested
 *     argument against keeping the change" — the water plane and the `wet_mud` strip at
 *     `province.js:1590-1602` are two transparent surfaces that meet at exactly the place this
 *     round is trying to soften, and lowering the water's alpha changes what shows through.
 *     `--mode sort` captures the frame three ways (all, strip hidden, plane hidden), derives the
 *     strip's own pixels and the land pixels, and reports what each arm does to each population
 *     separately. Land is the leak check: a water change that moves land pixels is out of bounds.
 *
 *  4. IT TAKES A FRAME-TIME READING, WHICH FOUR ROUNDS HAVE SHIPPED WITHOUT. Honestly labelled:
 *     `engine.js:9382` declares `renderCpuMs` unmeasurable on this container because it is
 *     SwiftShader, and that is quoted verbatim into the output. What `--mode perf` reports is a
 *     wall-clock software-rasteriser cost, with `gl.finish()` forcing completion, valid ONLY as a
 *     relative cost BETWEEN ARMS on the same box in the same process. It is not a frame time.
 *
 * THE S52 NULL IS CALIBRATED, NOT GUESSED. The r3 critic found the round's null was pinned to a
 * constant tuned at k = 4.5 and reproduced only 11% of the luma fall at k = 1.9 — "which looks
 * like the null failing and is actually the null being mis-calibrated". So `--mode arms` runs a
 * bisection on the null's constant transmittance until its mean luma over the PINNED mask matches
 * the arm under test, and prints the whole search. A null that under-reproduces the brightness
 * change is not a null, it is a flattering control.
 *
 *   node tools/visual/f7-r4-sweep.mjs --out <dir> --site <deck id> --mode arms|sort|perf|band
 *                                     --poses edge-b045,edge-b135,...
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { launchGame } from '../../../../../tools/lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
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
const OUT = path.resolve(REPO, args.out || 'corpus/90-verdicts/wave1/artifacts/W1-F7-WATER-r4/run');
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
const MODE = String(args.mode || 'arms');
const STEP_F = Number(args.step || 8);
const FROZEN_PHASE = Number(args.phase || 11.0);
const MASK_ARM = String(args.maskArm || 'prefix');
const MASK_THRESHOLDS = String(args.thresholds || '4,6,10').split(',').map(Number);
const PERF_ITERS = Number(args.perfIters || 16);
const CLOSE_R = Number(args.closeR || 4);
const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
const V = await import(path.join(REPO, 'tools/metrics/lib/vis03.mjs'));

const readPng = (b) => PNG.sync.read(b);
function lumOf(png) {
  const y = new Float32Array(png.width * png.height);
  for (let i = 0, j = 0; i < png.data.length; i += 4, j++) y[j] = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  return { y, w: png.width, h: png.height };
}

/* ---- the shoreline profile, carried over from r3 so the rows stay comparable ---------------
 * `dist` is a chamfer 3-4 distance transform from NON-MASK, evaluated inside the mask. In r3
 * that mask was the arm's own; here it is the PIN, so `gradient_width_px` is a distance transform
 * of a fixed boundary and the two arms' widths are measured from the same waterline. That single
 * change is what HAZARDS §25 is about: in r3 the fix moved the ruler it was measured with. */
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
/* ---- WHAT COUNTS AS "LAND" FOR A DISTANCE TRANSFORM ------------------------------------------
 * `gradient_width_px` is the rise distance of luma against DISTANCE FROM NON-WATER, and the r3
 * critic wrote the caveat its own headline depended on: "in the Deep Marshes that is reed clumps,
 * not a bank." Our marsh water is punched full of reed blades, tussocks and trunks, each of which
 * is a few pixels of non-water sitting in the middle of open water. A raw distance transform
 * therefore reports "3 px from land" for a pixel in the middle of a lake, and no fade of any width
 * can show up, because the profile's far bins never get populated by open water at all.
 *
 * So the distance is taken from a MORPHOLOGICALLY CLOSED copy of the mask — dilate by r, erode by
 * r — which swallows holes narrower than 2r and leaves the actual bank, a large connected region,
 * exactly where it was. Luma is still summed over the ORIGINAL pinned mask, so no land pixel ever
 * enters a luma figure; only the binning changes. Both widths are reported side by side, raw and
 * closed, with the number of pixels the closing moved, so a critic can see how much work it did.
 * The closing is applied identically to every arm because it is applied to THE PIN. */
function closeMask(m, W, H, r) {
  const N = W * H, dil = new Uint8Array(N), out = new Uint8Array(N);
  const box = (src, dst, want) => {
    // separable box min/max: horizontal then vertical
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
  box(m, dil, true);       // dilate
  box(dil, out, false);    // erode
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
  if (usable.length < 12) return { gradient_width_px: null, reason: `only ${usable.length} distance bins carry >= 40 px; the waterline in this frame is too short to profile`, profile: prof };
  const nearBins = usable.filter(([d]) => d <= 2).map(([, v]) => v);
  const plateauBins = usable.filter(([d]) => d >= 24).map(([, v]) => v).sort((a, b) => a - b);
  if (!nearBins.length || plateauBins.length < 6) return { gradient_width_px: null, reason: 'not enough near-shore or open-water bins to anchor the two ends of the profile', profile: prof };
  const first = nearBins.reduce((a, b) => a + b, 0) / nearBins.length;
  const last = plateauBins[Math.floor(plateauBins.length / 2)];
  const span = last - first;
  if (Math.abs(span) < 0.6) return { gradient_width_px: null, near_shore_luma: +first.toFixed(3), open_water_luma: +last.toFixed(3), span: +span.toFixed(3), reason: 'near-shore and open-water luma differ by < 0.6/255; there is no transition to measure the width of', profile: prof };
  const at = (frac) => { const t = first + span * frac; for (const [d, v] of usable) if (span > 0 ? v >= t : v <= t) return d; return usable[usable.length - 1][0]; };
  const d10 = at(0.10), d90 = at(0.90);
  return { profile: prof, near_shore_luma: +first.toFixed(3), open_water_luma: +last.toFixed(3), span: +span.toFixed(3), d10_px: d10, d90_px: d90, gradient_width_px: Math.max(1, d90 - d10) };
}
/** For the `probe-shoreT-*` arms ONLY this is the measurement; for every other arm it is a
 * histogram of the frame and is reported but meaningless. `transition_frac` is the fraction of
 * masked pixels strictly between the two plateaus — the fade's spatial extent, expressed as area
 * rather than as a screen distance so it does not depend on where the boundary happens to run. */
function fadeField(png, mask) {
  const o = lumOf(png);
  const hist = new Array(10).fill(0);
  let n = 0, lo = 0, hi = 0, mid = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const v = o.y[i] / 255; n++;
    hist[Math.min(9, Math.floor(v * 10))]++;
    if (v < 0.10) lo++; else if (v > 0.90) hi++; else mid++;
  }
  if (!n) return null;
  return {
    masked_px: n, decile_hist: hist,
    below_0p10: lo, above_0p90: hi, transition_px: mid,
    transition_frac: +(mid / n).toFixed(4),
    note: 'ONLY meaningful on a probe-shoreT-* arm, where the frame IS the fade field. transition_frac is the share of the water surface on which the fade is partway between off and full — i.e. the fade\'s extent. Tonemapping maps the value but not the ordering, so the extent survives it.',
  };
}

function maskedLuma(png, mask) {
  const o = lumOf(png); let n = 0, s = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) { n++; s += o.y[i]; }
  return { px: n, mean_luma: n ? +(s / n).toFixed(3) : null };
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
if (!site) { console.error(`unknown deck site ${SITE}`); await g.close(); process.exit(2); }
await g.h('teleport', site.place.x, site.place.z);
await step(40);
await g.h('setWeather', 'clear');
await g.h('setTimeOfDay', TIME);
await step(12);
const snap = await g.h('snapshot');
const [px, py, pz] = snap.player.pos;

/* ---- DID THE TELEPORT LAND WHERE THE DECK SAYS, AND IN THE REGION THE DECK NAMES? ------------
 * Looking at the very first frame this tool produced, the in-frame region label read
 * `western-rootlands` on a capture taken at the `vista-deep-marshes` stand. That is the same
 * symptom `tools/visual/f7-critic-deck-region.mjs` was written for in round 1, and it decides
 * whether every per-region number in this piece's history is attributed to the right region — so
 * it is measured here, in-process, off the RUNNING field, and printed before any arm. */
const standCheck = await g.page.evaluate(({ tx, tz }) => {
  const E = window.__ENGINE, f = E.field, p = E.sim.player.pos;
  const rAt = (x, z) => { const r = f && f.regionAt ? f.regionAt(x, z) : null; return r ? (r.id || r.name) : null; };
  return {
    deck_asked_for: [tx, tz],
    player_pos_after_teleport: [+p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2)],
    teleport_offset_m: +Math.hypot(p[0] - tx, p[2] - tz).toFixed(2),
    running_field_region_at_deck_point: rAt(tx, tz),
    running_field_region_at_player: rAt(p[0], p[2]),
    hud_region_name: (f && f.regionAt ? (f.regionAt(p[0], p[2]) || {}).name : null) || null,
  };
}, { tx: site.place.x, tz: site.place.z });
console.log('stand:', JSON.stringify(standCheck));

async function shot(name) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(OUT, 'frames', `${name}.png`), buf);
  return buf;
}

/* ---- THE DECLARED POSE SET ------------------------------------------------------------------ */
const censusRow = CENSUS.rows.find((r) => r.setup === SITE);
if (!censusRow) { console.error(`site ${SITE} is not in ${CENSUS_PATH}`); await g.close(); process.exit(2); }
const EDGE_TARGETS = new Map((censusRow.declared_pose_targets || []).filter(Boolean).map((t) => [t.bearing_deg, t]));

const topdown = (h) => g.h('camera', { pos: [px, py + h, pz], look: [px, py, pz + 0.001] });
async function orbit(yawDeg, pitchDeg, dist) {
  const yaw = yawDeg * Math.PI / 180, pit = pitchDeg * Math.PI / 180;
  await g.h('camera', {
    pos: [px - Math.sin(yaw) * Math.cos(pit) * dist, py + 1.5 + Math.sin(-pit) * dist, pz - Math.cos(yaw) * Math.cos(pit) * dist],
    look: [px, py + 1.2, pz],
  });
}
/** A `water_edge` pose per M12a clause 4: the camera stands BACK ALONG THE DECLARED BEARING from a
 * real waterline cell and looks at it, low. The cell is not chosen by eye — it is the nearest
 * waterline cell on that exact bearing, from the offline census. */
async function edgePose(bearingDeg, backM = 11, heightM = 3.0) {
  const t = EDGE_TARGETS.get(bearingDeg);
  if (!t) return { ok: false, why: `no waterline cell within the census cone on bearing ${bearingDeg}` };
  const b = bearingDeg * Math.PI / 180;
  const [tx, tz] = t.cell_centre;
  const wy = (t.water_y === null || t.water_y === undefined) ? t.ground_y : t.water_y;
  await g.h('camera', { pos: [tx - Math.sin(b) * backM, wy + heightM, tz - Math.cos(b) * backM], look: [tx, wy, tz] });
  return { ok: true, target: t };
}
const POSES = {
  'topdown-120': async () => ({ ok: true, kind: 'topdown' }),
  'c-vista-11-d26': async () => { await orbit(Number(site.camera.yaw_deg ?? 90), -11, 26); return { ok: true, kind: 'vista' }; },
  ...Object.fromEntries([45, 135, 225, 315].map((b) => [`edge-b${String(b).padStart(3, '0')}`,
    async () => ({ ...(await edgePose(b)), kind: 'water_edge', bearing_deg: b })])),
  ...Object.fromEntries([0, 90, 180, 270].map((y) => [`eye-yaw${String(y).padStart(3, '0')}`,
    async () => { await orbit(y, -8, 7); return { ok: true, kind: 'eye', bearing_deg: y }; }])),
};
POSES['topdown-120'] = async () => { await topdown(120); return { ok: true, kind: 'topdown' }; };

/** M12a clause 4, MEASURED not asserted: is the declared waterline target actually on screen? */
const project = (x, y, z) => g.h('projectPoint', x, y, z);

/* ---- phase freeze --------------------------------------------------------------------------- */
const freezePhase = (v) => g.page.evaluate((v) => {
  const R = window.__ENGINE.renderer, mats = new Set();
  R.scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m && m.userData && m.userData.waterUniforms) mats.add(m); });
  window.__R4_MATS = mats;
  let n = 0;
  for (const m of mats) {
    const u = m.userData.waterUniforms.uWaterPhase;
    if (!u.__r4Frozen) { Object.defineProperty(u, 'value', { get() { return v; }, set() { /* the sim's writes are deliberately dropped */ }, configurable: true }); u.__r4Frozen = true; }
    n++;
  }
  return { materials: n, frozen_at: v };
}, v);

/* ---- what actually reached the GPU, INCLUDING the sort state the r3 status got wrong -------- */
const gpuState = () => g.page.evaluate(() => {
  const R = window.__ENGINE.renderer, rows = [];
  R.scene.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) if (m && m.userData && m.userData.waterUniforms) {
      const u = m.userData.waterUniforms;
      rows.push({ mesh: o.name || '(unnamed)', region_resolved: m.userData.waterRegionResolved || null,
        uWaterK: u.uWaterK ? u.uWaterK.value : null,
        uWaterShoreFade: u.uWaterShoreFade ? u.uWaterShoreFade.value : null,
        uWaterShoreBandM: u.uWaterShoreBandM ? u.uWaterShoreBandM.value : 'ABSENT — this build predates F7 r4',
        phase_frozen: !!u.uWaterPhase.__r4Frozen,
        transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite, depthTest: m.depthTest, renderOrder: o.renderOrder });
    }
  });
  // The wet-bank strip is a DIFFERENT material (province.js:1590 `wet_mud`) with no water uniforms,
  // so it is enumerated separately; its sort state is the whole transparency question.
  const strips = [];
  R.scene.traverse((o) => {
    if (!/^water:shoreline:/.test(o.name || '')) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    strips.push({ mesh: o.name, waterRole: o.userData && o.userData.waterRole || null, renderOrder: o.renderOrder,
      transparent: m && m.transparent, opacity: m && m.opacity, depthWrite: m && m.depthWrite, depthTest: m && m.depthTest });
  });
  const seen = new Set(), uniq = [];
  for (const r of rows) { const key = `${r.region_resolved}|${r.uWaterK}|${r.uWaterShoreFade}|${r.uWaterShoreBandM}`; if (!seen.has(key)) { seen.add(key); uniq.push(r); } }
  const sSeen = new Set(), sUniq = [];
  for (const s of strips) { const key = `${s.renderOrder}|${s.opacity}|${s.depthWrite}|${s.depthTest}`; if (!sSeen.has(key)) { sSeen.add(key); sUniq.push(s); } }
  return { water_materials: rows.length, distinct: uniq, wet_bank_strips: strips.length, strip_distinct: sUniq };
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
// The round-2 body colour restored verbatim, with esTrans pinned to 0 AND the r4 shore block
// deleted, so the alpha line is gone rather than merely neutral. Getting this wrong is the trap:
// with esDepthM = 0 and the band line left in, smoothstep(0, band, 0) = 0 makes esBandM = 1 and
// the "round-2" arm would fade harder than the fix. Both edits are asserted to apply.
const R2_DEPTH_BLOCK = `        float esQ=1.0; float esDepthM=0.0; vec3 esAlbedo=diffuseColor.rgb;
        float esPath=0.0; float esTrans=0.0;
        vec3 esDepth=vec3(.038,.105,.118)+diffuseColor.rgb*.21;`;
const R2_SHORE_BLOCK = `        float esBandM=0.0; float esShoreT=0.0;`;
// Round 3 restored as a SHADER arm — the alpha line gated on transmittance alone. It exists to
// cross-check the uniform ablation (`--arms r3`), which claims to be exact. If the two disagree
// the uniform ablation is not exact and every row that used it is void.
const R3_SHORE_BLOCK = `        float esBandM=0.0;
        float esShoreT=esTrans;
        diffuseColor.a=mix(diffuseColor.a,diffuseColor.a*.42,esShoreT*clamp(uWaterShoreFade,0.0,1.0));`;

/* ---- THE DIRECT PROBE: RENDER THE FADE FIELD ITSELF ------------------------------------------
 * `gradient_width_px` measures luma against distance-from-land, so it reads the SCENE as much as
 * the shader: at three of four declared Deep Marshes poses it does not move at all while the arm's
 * own mean luma moves 5-8%. That is a weak instrument for the one quantity actually in dispute —
 * HOW WIDE IS THE FADE — and the r2 tool already established the better technique for this piece
 * by writing the reflection weight itself into the frame.
 *
 * So these two arms paint `esShoreT`, the fade term, straight into the water surface as greyscale
 * and force alpha to 1 so nothing composites over it. Tonemapping still maps the value, but it
 * maps it MONOTONICALLY, so the SPATIAL EXTENT of the transition — the only thing being claimed —
 * survives it. The transition band is the population of water pixels strictly between the black
 * and white plateaus; a fade that collapses at k = 4.5 has almost none, and a fade that spans a
 * metre of column has many. Scored over the same pinned mask as everything else. */
const OUTGOING_LINE = `        outgoingLight=mix(outgoingLight,esSurface,.68);`;
const PROBE_TAIL = `        outgoingLight=vec3(clamp(esShoreT,0.0,1.0));
        diffuseColor.a=1.0;`;
const PROBE_R3_TAIL = `        outgoingLight=vec3(clamp(esTrans,0.0,1.0));
        diffuseColor.a=1.0;`;

const waterSrc = fs.readFileSync(path.join(REPO, 'game/src/render/water.js'), 'utf8');
const asserted = {
  r3_depth_block: waterSrc.includes(R3_DEPTH_BLOCK),
  r4_shore_band_block: waterSrc.includes(R4_SHORE_BLOCK),
  r2_schlick_weight: waterSrc.includes('float esF0=.02;'),
  shore_band_uniform: waterSrc.includes('uWaterShoreBandM:{value:1.20}'),
  region_k_uniform: waterSrc.includes('uWaterK:{value:waterRegionDiag.fallback_k}'),
  critic_grep_still_zero: (waterSrc.match(/depthTexture|tDepth|depthFade/g) || []).length === 0,
};

let NULL_TRANS = Number(args.nullTrans || 0.5);
const SHADER_ARMS = () => ({
  prefix: [[R3_DEPTH_BLOCK, R2_DEPTH_BLOCK], [R4_SHORE_BLOCK, R2_SHORE_BLOCK]],
  'r3-shader': [[R4_SHORE_BLOCK, R3_SHORE_BLOCK]],
  // S52's plausible wrong answer, and the ONLY arm whose constant is fitted: transmittance
  // becomes a constant and the metre band is deleted, so the arm has the same average brightness
  // change with NO depth dependence, NO k dependence and NO shore geometry anywhere. Anything it
  // reproduces is a brightness proxy and inadmissible in both directions.
  'null-const-trans': [[TRANS_LINE, `        float esTrans=${NULL_TRANS.toFixed(4)};`], [BAND_LINE, `        float esBandM=0.0;`]],
  // The r4 fade field, painted. Everything after it in the shader still runs; only what reaches
  // the framebuffer changes, so the geometry, the mask and the pose are untouched.
  'probe-shoreT-r4': [[OUTGOING_LINE, PROBE_TAIL]],
  // The r3 fade field — transmittance alone — painted the same way, for the same pose and mask.
  'probe-shoreT-r3': [[OUTGOING_LINE, PROBE_R3_TAIL]],
});
const UNIFORM_ARMS = {
  fixed: {},
  'nothing-restore-control': {},
  r3: { uWaterShoreBandM: 0.0001 },                  // exact round 3 — the band is identically 0
  'no-shorefade': { uWaterShoreFade: 0 },            // the depth COLOUR half alone
  // ---- ADDED BY THE F7 r4 CRITIC, and this is the ONLY change to the builder's instrument. ----
  // The round's band sweep covered 0.60 / 1.20 / 1.35 and concluded "no band constant rescues it,
  // so it is not a tuning problem". Every one of those constants sits ABOVE the median wet-corner
  // depth in frame (Deep Marshes p50 = 0.824 m, Western Rootlands p50 = 0.375 m), i.e. entirely
  // inside the regime where the term is broad rather than shore-local. These four arms enter the
  // regime the sweep never tested. Nothing else in this file is modified.
  'band-0.10': { uWaterShoreBandM: 0.10 },
  'band-0.20': { uWaterShoreBandM: 0.20 },
  'band-0.30': { uWaterShoreBandM: 0.30 },
  'band-0.45': { uWaterShoreBandM: 0.45 },
  'band-0.60': { uWaterShoreBandM: 0.60 },
  'band-1.35': { uWaterShoreBandM: 1.35 },
};

const applyShaderArm = (armId, edits) => g.page.evaluate(({ armId, edits }) => {
  const mats = window.__R4_MATS || new Set();
  window.__R4_EDITS = 0;
  window.__R4_SEQ = (window.__R4_SEQ || 0) + 1;
  for (const m of mats) {
    if (!m.__r4OrigOBC) { m.__r4OrigOBC = m.onBeforeCompile; m.__r4OrigKey = m.customProgramCacheKey; }
    m.onBeforeCompile = function (shader, renderer) {
      m.__r4OrigOBC.call(this, shader, renderer);
      for (const [needle, rep] of edits) if (shader.fragmentShader.includes(needle)) { shader.fragmentShader = shader.fragmentShader.split(needle).join(rep); window.__R4_EDITS++; }
    };
    const key = `f7-r4:${armId}:${window.__R4_SEQ}`;
    m.customProgramCacheKey = () => key; m.needsUpdate = true;
  }
  return { materials: mats.size, edits_expected: edits.length };
}, { armId, edits });
const editCount = () => g.page.evaluate(() => window.__R4_EDITS || 0);
const restoreShader = () => g.page.evaluate(() => {
  window.__R4_SEQ = (window.__R4_SEQ || 0) + 1;
  for (const m of (window.__R4_MATS || [])) if (m.__r4OrigOBC) { m.onBeforeCompile = m.__r4OrigOBC; m.customProgramCacheKey = m.__r4OrigKey; m.needsUpdate = true; }
});
const setUniforms = (over) => g.page.evaluate((over) => {
  let n = 0;
  for (const m of (window.__R4_MATS || [])) {
    const u = m.userData.waterUniforms;
    if (!m.__r4UBase) m.__r4UBase = { uWaterK: u.uWaterK.value, uWaterShoreFade: u.uWaterShoreFade.value, uWaterShoreBandM: u.uWaterShoreBandM ? u.uWaterShoreBandM.value : null };
    u.uWaterK.value = ('uWaterK' in over) ? over.uWaterK : m.__r4UBase.uWaterK;
    u.uWaterShoreFade.value = ('uWaterShoreFade' in over) ? over.uWaterShoreFade : m.__r4UBase.uWaterShoreFade;
    if (u.uWaterShoreBandM) u.uWaterShoreBandM.value = ('uWaterShoreBandM' in over) ? over.uWaterShoreBandM : m.__r4UBase.uWaterShoreBandM;
    n++;
  }
  return n;
}, over);
/** `which`: 'plane' hides the region water meshes, 'strip' hides only the wet-bank deposits,
 * 'all' hides both. The name test is exact: `water:<id>` vs `water:shoreline:<id>`. */
const hide = (which) => g.page.evaluate((which) => {
  const R = window.__ENGINE.renderer; window.__R4_HID = []; let n = 0;
  R.scene.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh) || !o.visible) return;
    const nm = o.name || '';
    const isStrip = /^water:shoreline:/.test(nm), isPlane = /^water:/.test(nm) && !isStrip;
    if (!(which === 'all' ? (isStrip || isPlane) : which === 'strip' ? isStrip : isPlane)) return;
    window.__R4_HID.push(o); o.visible = false; n++;
  });
  return n;
}, which);
const unhide = () => g.page.evaluate(() => { for (const o of (window.__R4_HID || [])) o.visible = true; window.__R4_HID = []; });

/** The SwiftShader relative cost. `engine.js:9382`'s own words are carried into the output. */
const perfProbe = (iters) => g.page.evaluate((iters) => {
  const R = window.__ENGINE.renderer;
  const three = R.three || R.renderer, gl = three.getContext();
  for (let i = 0; i < 4; i++) three.render(R.scene, R.camera);
  gl.finish();
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) three.render(R.scene, R.camera);
  gl.finish();
  const t1 = performance.now();
  return { iters, total_ms: +(t1 - t0).toFixed(3), ms_per_world_pass: +((t1 - t0) / iters).toFixed(4) };
}, iters);

let commit = 'unknown';
try { commit = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim(); } catch (e) { /* clone */ }

const out = {
  tool: 'f7-r4-sweep', roadmap_item: 'F7', generated: new Date().toISOString(), commit, seed: SEED,
  site: SITE, region_from_census: censusRow.region_actual, region_k: censusRow.region_k,
  stand_verification: standCheck,
  time_of_day: TIME, canvas: [CW, CH], mode: MODE, frozen_phase: FROZEN_PHASE,
  mask_policy: {
    pinned: true, mask_arm: MASK_ARM, thresholds: MASK_THRESHOLDS,
    why: 'HAZARDS §25 / RI-VIS03 M12a closing paragraph. One mask per pose, derived from the named baseline arm, and EVERY arm is scored through it. Each arm\'s own mask is still computed and reported as own_mask_px so a moving mask is a finding rather than a hidden confound.',
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
  poses: {}, sort: {}, perf: {}, null_calibration: null, pageErrors: [],
};
g.page.on('pageerror', (e) => out.pageErrors.push(String(e.message || e)));
const write = () => fs.writeFileSync(path.join(OUT, 'sweep.json'), JSON.stringify(out, null, 2));
write();
if (!asserted.r4_shore_band_block) { console.error('R4 SHORE BAND BLOCK NOT IN water.js — refusing to measure'); await g.close(); process.exit(3); }

out.phase_freeze = await freezePhase(FROZEN_PHASE);
await step(6);
out.gpu_state_before = await gpuState();
write();
console.log('gpu:', JSON.stringify(out.gpu_state_before.distinct));
console.log('strips:', JSON.stringify(out.gpu_state_before.strip_distinct));

/* ---- the pinned mask ------------------------------------------------------------------------ */
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
    return { shader: true, edits_applied: n, edits_expected: res.edits_expected, materials: res.materials,
      VACUOUS: n < res.edits_expected * res.materials ? null : null };
  }
  await restoreShader(); await setUniforms(UNIFORM_ARMS[armId] || {}); await step(6);
  return { shader: false };
}
const clearArm = async () => { await restoreShader(); await setUniforms({}); await step(6); };

/** EVERY capture in this tool goes through here, so the hidden frame, the pin and each arm are all
 * taken with the identical pose/hide/step/shot sequence. The first version stepped 8 frames before
 * the hidden frame and 22 before the pin, and the two were then differenced to build the mask — so
 * fourteen frames of canopy drift were being counted as water. The prefix arm, which IS the mask
 * arm, came back with an own-mask delta of +57.77% against its own pin, which is how it was found. */
async function captureAt(poseId, tag, hideWhat = null) {
  await POSES[poseId]();
  const n = hideWhat ? await hide(hideWhat) : 0;
  await step(STEP_F);
  const buf = await shot(tag);
  if (hideWhat) { await unhide(); }
  return Object.assign(buf, { meshes_hidden: n });
}

async function preparePose(poseId) {
  const meta = await POSES[poseId]();
  await step(STEP_F);
  const rec = { pose: poseId, ...meta, water_edge_verified: null };
  if (!meta.ok) { rec.void = true; return rec; }
  if (meta.kind === 'water_edge' && meta.target) {
    const [tx, tz] = meta.target.cell_centre;
    const wy = (meta.target.water_y === null || meta.target.water_y === undefined) ? meta.target.ground_y : meta.target.water_y;
    // `engine.projectPoint` returns { ndc:[x,y], z, in_front, on_screen } — read this turn at
    // engine.js:9060, not assumed. `on_screen` is the harness's own |ndc| <= 1 test.
    const pr = await project(tx, wy, tz);
    rec.water_edge_verified = { projectPoint: pr, on_screen: !!(pr && pr.on_screen && pr.in_front) };
  }
  // The hidden frame and the PIN are taken once, here, before any arm is measured — and through
  // `captureAt`, i.e. the same protocol every arm uses.
  await applyArm(MASK_ARM);
  const hiddenBuf = await captureAt(poseId, `${poseId}--water-hidden`, 'all');
  const nHidden = hiddenBuf.meshes_hidden;
  const pinBuf = await captureAt(poseId, `${poseId}--PIN-${MASK_ARM}`);
  await clearArm();
  const hiddenPng = readPng(hiddenBuf), pinPng = readPng(pinBuf);
  const pins = {};
  for (const thr of MASK_THRESHOLDS) {
    const { m, n } = maskFrom(pinPng, hiddenPng, thr);
    const { closed, moved } = closeMask(m, pinPng.width, pinPng.height, CLOSE_R);
    pins[thr] = {
      mask: m, px: n,
      dist_raw: distanceFromLand(m, pinPng.width, pinPng.height),
      dist_closed: distanceFromLand(closed, pinPng.width, pinPng.height),
      close_radius_px: CLOSE_R, close_moved_px: moved,
    };
  }
  rec.meshes_hidden = nHidden;
  rec.pinned_mask_px = Object.fromEntries(MASK_THRESHOLDS.map((t) => [t, pins[t].px]));
  rec.mask_closing = Object.fromEntries(MASK_THRESHOLDS.map((t) => [t, { radius_px: pins[t].close_radius_px, pixels_moved: pins[t].close_moved_px, pct_of_mask: pins[t].px ? +(100 * pins[t].close_moved_px / pins[t].px).toFixed(2) : null }]));
  // THE MASK'S OWN BAND, WITHOUT WHICH `own_mask_delta_pct` IS UNREADABLE. The mask is a
  // difference of two frames, and `stepFrames` advances the canopy, the sun and the reflection
  // target between any two captures even with `uWaterPhase` frozen (the r3 critic established
  // that the freeze fixes the water and not the scene). So a mask built by differencing carries
  // scene drift as well as water. This takes the pin a SECOND time, through the identical
  // protocol, and reports how far the mask moves when NOTHING changed. Any arm whose own-mask
  // delta is inside this replicate spread has not moved its mask at all.
  await applyArm(MASK_ARM);
  const pin2Buf = await captureAt(poseId, `${poseId}--PIN2-${MASK_ARM}`);
  await clearArm();
  const pin2Png = readPng(pin2Buf);
  rec.pin_replicate = Object.fromEntries(MASK_THRESHOLDS.map((t) => {
    const r2 = maskFrom(pin2Png, hiddenPng, t);
    return [t, { pin_px: pins[t].px, replicate_px: r2.n, replicate_delta_pct: pins[t].px ? +(100 * (r2.n - pins[t].px) / pins[t].px).toFixed(2) : null }];
  }));
  rec.pin_replicate_note = 'Two captures of the SAME arm through the SAME protocol. This is the band on every `own_mask_delta_pct` below; a delta inside it is nothing.';
  maskStore.set(poseId, { hiddenPng, pins, W: pinPng.width, H: pinPng.height });
  return rec;
}

async function measureArm(poseId, armId, ordinal) {
  const store = maskStore.get(poseId);
  const applied = await applyArm(armId);
  const buf = await captureAt(poseId, `${poseId}--${armId}-o${ordinal}`);
  const png = readPng(buf);
  const row = { arm: armId, frame: `frames/${poseId}--${armId}-o${ordinal}.png`, ...applied, by_threshold: {} };
  if (applied.shader && !applied.edits_applied) {
    row.VACUOUS = `FAIL — the ${armId} edit matched nothing in the compiled shader. NOT a result and must not be read as one.`;
    await clearArm(); return row;
  }
  for (const thr of MASK_THRESHOLDS) {
    const pin = store.pins[thr];
    const own = maskFrom(png, store.hiddenPng, thr);
    const m12 = V.M12(V.prepare(png), pin.mask, { sequence: [] });
    row.by_threshold[thr] = {
      pinned_mask_px: pin.px,
      own_mask_px: own.n,
      own_mask_delta_pct: pin.px ? +(100 * (own.n - pin.px) / pin.px).toFixed(2) : null,
      ...maskedLuma(png, pin.mask),
      m12: Object.fromEntries(Object.entries(m12).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(5) : v])),
      // HEADLINE: distance binned from the CLOSED mask, i.e. from the bank rather than from every
      // reed blade. `shore_raw` is the r3-comparable figure and is reported beside it always.
      shore: shoreProfile(png, pin.mask, pin.dist_closed),
      shore_raw: shoreProfile(png, pin.mask, pin.dist_raw),
      close_radius_px: pin.close_radius_px, close_moved_px: pin.close_moved_px,
      fade_field: fadeField(png, pin.mask),
    };
  }
  await clearArm();
  return row;
}

const POSE_LIST = String(args.poses || 'edge-b045,edge-b135,edge-b225,edge-b315').split(',').map((s) => s.trim()).filter(Boolean);
for (const p of POSE_LIST) if (!POSES[p]) { console.error(`unknown pose ${p}`); await g.close(); process.exit(2); }

/* ---- 1. ARMS ------------------------------------------------------------------------------- */
if (MODE === 'arms' || MODE === 'band') {
  const DEFAULT = MODE === 'band'
    ? 'prefix,r3,band-0.60,fixed,band-1.35,nothing-restore-control'
    : 'prefix,r3,r3-shader,fixed,no-shorefade,null-const-trans,nothing-restore-control';
  const ARMS = String(args.arms || DEFAULT).split(',');
  for (const poseId of POSE_LIST) {
    const rec = await preparePose(poseId);
    out.poses[poseId] = { ...rec, arms: {} };
    write();
    if (rec.void) { console.log(`${poseId}: VOID — ${rec.why}`); continue; }
    let ord = 0;
    for (const armId of ARMS) {
      // The null's constant is FITTED to the fixed arm's brightness over the pinned mask, once,
      // at the first pose that has a `fixed` row. An unfitted null under-reproduces the change and
      // flatters the build; the r3 critic caught exactly that at k = 1.9.
      if (armId === 'null-const-trans' && out.poses[poseId].arms.fixed && !out.null_calibration) {
        const target = out.poses[poseId].arms.fixed.by_threshold[MASK_THRESHOLDS[0]].mean_luma;
        const trace = [];
        const probeAt = async (t, tag) => {
          NULL_TRANS = t;
          const probe = await measureArm(poseId, 'null-const-trans', tag);
          const lum = probe.by_threshold[MASK_THRESHOLDS[0]] && probe.by_threshold[MASK_THRESHOLDS[0]].mean_luma;
          trace.push({ tag, nullTrans: +t.toFixed(4), mean_luma: lum, target, vacuous: !!probe.VACUOUS });
          console.log(`  null cal ${tag}: trans=${t.toFixed(4)} luma=${lum} target=${target}`);
          return lum;
        };
        // THE DIRECTION IS MEASURED, NOT ASSUMED. The first version of this search hard-coded
        // "more transmittance = brighter" and walked AWAY from the target for three iterations,
        // because in a drowned marsh the bed under the water is DARKER than the water, so raising
        // transmittance DARKENS the frame. Both ends are probed first and the bisection follows
        // whichever way the scene actually goes; if the target is outside [lo, hi] the search says
        // so instead of converging on an endpoint and calling it matched.
        let lo = 0.02, hi = 0.98;
        const lumLo = await probeAt(lo, 'end-lo'), lumHi = await probeAt(hi, 'end-hi');
        let bracketed = null;
        if (typeof lumLo === 'number' && typeof lumHi === 'number') {
          bracketed = (target >= Math.min(lumLo, lumHi) && target <= Math.max(lumLo, lumHi));
          const decreasing = lumHi < lumLo;
          for (let it = 0; bracketed && it < 4; it++) {
            const mid = (lo + hi) / 2;
            const lum = await probeAt(mid, `bisect${it}`);
            if (typeof lum !== 'number') break;
            if (decreasing ? (lum > target) : (lum < target)) lo = mid; else hi = mid;
          }
        }
        const best = trace.filter((t) => typeof t.mean_luma === 'number').sort((a, b) => Math.abs(a.mean_luma - target) - Math.abs(b.mean_luma - target))[0];
        if (best) NULL_TRANS = best.nullTrans;
        out.null_calibration = { fitted_at_pose: poseId, threshold: MASK_THRESHOLDS[0], target_mean_luma: target, trace, chosen: best || null,
          target_is_bracketed_by_the_null: bracketed,
          if_not_bracketed: 'The null CANNOT reach the arm\'s brightness at any constant transmittance. That is itself a result: it means the change is not on the brightness axis the null can travel, and the matched-luminance comparison S52 asks for is unavailable rather than merely unfavourable. The closest reachable row is reported and labelled.',
          why: 'ARBITRATION S52. A null pinned to a constant chosen for one region reproduced only 11% of the luma change in another and looked like the null failing. The constant is fitted to the arm under test so the null is at MATCHED LUMINANCE and any width it fails to reproduce is width the brightness cannot explain.' };
        write();
      }
      const row = await measureArm(poseId, armId, ord++);
      out.poses[poseId].arms[armId] = row; write();
      const t = row.by_threshold && row.by_threshold[MASK_THRESHOLDS[0]];
      console.log(`${poseId} ${armId}: luma=${t && t.mean_luma} width=${t && t.shore && t.shore.gradient_width_px} widthRaw=${t && t.shore_raw && t.shore_raw.gradient_width_px} fadeTrans=${t && t.fade_field && t.fade_field.transition_frac} FD=${t && t.m12.FresnelDelta} SD=${t && t.m12.ShoreDelta} NE=${t && t.m12.NormalEnergy} ownMaskΔ=${t && t.own_mask_delta_pct}%${row.VACUOUS ? '  VACUOUS' : ''}`);
    }
  }
}

/* ---- 2. THE TRANSPARENCY SORT AGAINST THE WET-BANK STRIP ------------------------------------ */
if (MODE === 'sort') {
  const ARMS = String(args.arms || 'prefix,r3,fixed').split(',');
  for (const poseId of POSE_LIST) {
    const meta = await POSES[poseId]();
    await step(STEP_F);
    if (!meta.ok) { out.sort[poseId] = { void: true, why: meta.why }; write(); continue; }
    // Three hidden bases, taken once, from the SAME arm the mask is pinned to.
    await applyArm(MASK_ARM);
    const nAll = await hide('all'); await step(4); const bAll = await shot(`sort-${poseId}--none`); await unhide(); await step(4);
    const nStrip = await hide('strip'); await step(4); const bNoStrip = await shot(`sort-${poseId}--no-strip`); await unhide(); await step(4);
    const nPlane = await hide('plane'); await step(4); const bNoPlane = await shot(`sort-${poseId}--no-plane`); await unhide(); await step(4);
    const bFull = await shot(`sort-${poseId}--full-PIN-${MASK_ARM}`);
    await clearArm();
    const pAll = readPng(bAll), pNoStrip = readPng(bNoStrip), pNoPlane = readPng(bNoPlane), pFull = readPng(bFull);
    const N = pFull.width * pFull.height;
    const strip = new Uint8Array(N), plane = new Uint8Array(N), land = new Uint8Array(N);
    let ns = 0, np = 0, nl = 0;
    for (let i = 0, q = 0; i < N; i++, q += 4) {
      const dStrip = Math.abs(pFull.data[q] - pNoStrip.data[q]) + Math.abs(pFull.data[q + 1] - pNoStrip.data[q + 1]) + Math.abs(pFull.data[q + 2] - pNoStrip.data[q + 2]);
      const dPlane = Math.abs(pFull.data[q] - pNoPlane.data[q]) + Math.abs(pFull.data[q + 1] - pNoPlane.data[q + 1]) + Math.abs(pFull.data[q + 2] - pNoPlane.data[q + 2]);
      const dAll = Math.abs(pFull.data[q] - pAll.data[q]) + Math.abs(pFull.data[q + 1] - pAll.data[q + 1]) + Math.abs(pFull.data[q + 2] - pAll.data[q + 2]);
      if (dStrip > 6) { strip[i] = 1; ns++; }
      else if (dPlane > 6) { plane[i] = 1; np++; }
      if (dAll <= 6) { land[i] = 1; nl++; }
    }
    const rows = {};
    let ord = 0;
    for (const armId of ARMS) {
      await applyArm(armId);
      await POSES[poseId](); await step(STEP_F);
      const buf = await shot(`sort-${poseId}--${armId}-o${ord++}`);
      const png = readPng(buf);
      rows[armId] = {
        strip_px: ns, strip: maskedLuma(png, strip),
        plane_only: maskedLuma(png, plane),
        land_leak_check: maskedLuma(png, land),
      };
      await clearArm();
      console.log(`sort ${poseId} ${armId}: strip=${rows[armId].strip.mean_luma} planeOnly=${rows[armId].plane_only.mean_luma} land=${rows[armId].land_leak_check.mean_luma}`);
    }
    const base = rows[ARMS[0]];
    out.sort[poseId] = {
      meshes_hidden: { all: nAll, strip: nStrip, plane: nPlane },
      populations: { strip_px: ns, plane_only_px: np, land_px: nl },
      sort_state: (await gpuState()).strip_distinct,
      arms: rows,
      deltas_against_first_arm: Object.fromEntries(ARMS.map((a) => [a, {
        strip: rows[a].strip.mean_luma === null || base.strip.mean_luma === null ? null : +(rows[a].strip.mean_luma - base.strip.mean_luma).toFixed(3),
        plane_only: rows[a].plane_only.mean_luma === null || base.plane_only.mean_luma === null ? null : +(rows[a].plane_only.mean_luma - base.plane_only.mean_luma).toFixed(3),
        land: rows[a].land_leak_check.mean_luma === null || base.land_leak_check.mean_luma === null ? null : +(rows[a].land_leak_check.mean_luma - base.land_leak_check.mean_luma).toFixed(3),
      }])),
      how_to_read_it: 'The wet-bank strip (province.js:1590, `wet_mud`, its own material) is NOT touched by this round. `land` is the leak check and must not move. `strip` moving is EXPECTED, because the strip is itself semi-transparent and the water is what shows through it — the question is whether it moves further than the water it sits on, which would mean the change is leaking into the bank rather than softening the waterline.',
    };
    write();
  }
}

/* ---- 3. FRAME TIME -------------------------------------------------------------------------- */
if (MODE === 'perf') {
  const ARMS = String(args.arms || 'prefix,r3,fixed,nothing-restore-control').split(',');
  for (const poseId of POSE_LIST) {
    const meta = await POSES[poseId]();
    await step(STEP_F);
    if (!meta.ok) { out.perf[poseId] = { void: true, why: meta.why }; write(); continue; }
    const rows = {};
    for (const armId of ARMS) {
      await applyArm(armId);
      await POSES[poseId](); await step(STEP_F);
      const a = await perfProbe(PERF_ITERS), b = await perfProbe(PERF_ITERS);
      rows[armId] = { run_a: a, run_b: b, ms_per_world_pass_mean: +((a.ms_per_world_pass + b.ms_per_world_pass) / 2).toFixed(4),
        replicate_spread_ms: +Math.abs(a.ms_per_world_pass - b.ms_per_world_pass).toFixed(4) };
      await clearArm();
      console.log(`perf ${poseId} ${armId}: ${rows[armId].ms_per_world_pass_mean} ms/world-pass (spread ${rows[armId].replicate_spread_ms})`);
    }
    out.perf[poseId] = {
      arms: rows,
      stats_from_engine: await g.h('getPerfStats'),
      what_this_is_NOT: 'NOT a frame time. engine.js:9382 declares renderCpuMs unmeasurable here in its own words: "Tier-H. This container is SwiftShader; a wall-clock render time here is a fact about the software rasteriser, not the game (RI-PLT01 §A/T1)." This is the WORLD PASS only (three.render(scene, camera)), with gl.finish() forcing completion, repeated and replicated. It is valid ONLY as a relative cost between arms in the same process on the same box, and the replicate spread is printed beside it so a difference smaller than the spread can be read as nothing.',
    };
    write();
  }
}

out.gpu_state_after = await gpuState();
write();
await g.close();
console.log(`\nwrote ${path.join(OUT, 'sweep.json')}`);
