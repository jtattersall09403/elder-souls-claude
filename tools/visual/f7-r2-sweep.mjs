#!/usr/bin/env node
/**
 * f7-r2-sweep.mjs — F7 ROUND 2. THE FOUR ACCEPTANCE CLAUSES OF THE r1 VERDICT, ON ONE BROWSER.
 *
 * The bar is `corpus/90-verdicts/wave1/W1-F7-WATER-r1.json` -> `biggest_gap.remedy`, clauses (a)-(d).
 * This tool measures all four on the same arms in the same process, so no clause can be satisfied by
 * a different capture than the one that satisfied its neighbour.
 *
 *   (a) THE COMPOSITED REFLECTION WEIGHT, MEASURED OFF THE GPU RATHER THAN DERIVED.
 *       Round 1's weights (.610 -> .250 etc.) are arithmetic on the shader text evaluated at
 *       nominal angles. Here the shader writes the quantity ITSELF into the frame as a GREY, with
 *       `diffuseColor.a` forced to 1 (the water is transparent, so an unforced alpha would blend
 *       the probe with whatever is behind it) — one pass for the weight, one for view distance,
 *       one for esView. The stored byte is NOT the written value: `renderer.js:91` sets
 *       ACESFilmicToneMapping at exposure .72 (`:95`) and `:90` sets an sRGB output colour space,
 *       and the first version of this tool proved that deleting `#include <tonemapping_fragment>`
 *       and `<colorspace_fragment>` from the water program does not stop it (a written
 *       vec3(.25,.50,.75) came back as (136,199,212) with 25 substitutions reported). So the
 *       chain is not argued about, it is MEASURED: `probe-ramp` writes a known grey ramp across
 *       the frame in the same run, which is the transfer curve, and every other probe byte is
 *       inverted through it. ACES is a matrix and mixes channels, but both its matrices' rows sum
 *       to 1, so neutrals stay neutral and a grey probe survives it; that is why the probes are
 *       grey and not packed into three channels. Because distance and esView are captured as
 *       their own fields, the clause's two cases — "straight down at 120 m" and "the 60 m grazing
 *       vista" — are read as BINS of a measured joint distribution, not as hand-chosen angles.
 *
 *   (b) RI-VIS03 M12 `FresnelDelta` >= 0.05 AND POSITIVE, at a `water_edge` shot. The r1 critic
 *       ran M12 at the deck vista pose where the water mask reaches row 0, which makes `ReflCorr`
 *       and `NormalEnergy` unmeasurable; its own method_deviations asks round 2 for a shot with
 *       sky and bank above the waterline. Both poses are captured and both are reported.
 *
 *   (c) `lane_power_normalised` on the water mask at the top-down pose, REPORTED ALONGSIDE
 *       `mean_luma`, using the r1 critic's own estimator (a masked lane-scale band-pass and an
 *       angular projection-variance scan) so the r1 number 0.000485 is comparable.
 *
 *   (d) THE S59 PRESERVATION CLAUSE: mean luma on the water mask, the grazing composite weight,
 *       and M12 `ShoreDelta`. Without it this remedy passes by making the water black.
 *
 * EVERY NUMBER THE INSTRUMENT EMITS IS WRITTEN, including the ones that move the wrong way. Round 1
 * failed for reporting `x_rms` (-28.9%) and not `lane_power` (+12.1%) and `lane_aniso` (+48.1%) from
 * the same tool call, which is ARBITRATION S59's unpaired-metric pattern. So the r1 top-down
 * estimator (x_rms / lane_power / lane_aniso, unmasked, exactly as `w1-water-lane-pitch.mjs`
 * computes them) rides alongside the masked ones and all six are printed for every arm.
 *
 * ARMS. Two shader arms produced by live `onBeforeCompile` editing in ONE process, so they cannot
 * differ by anything except the term under test, plus a null control and two mesh controls:
 *   fixed   HEAD — the round-2 Schlick weight. No edit.
 *   prefix  round 1 as shipped (b0f3224e), reconstructed by substituting the r1 expression back.
 *   null-uniform-dim  THE PLAUSIBLE WRONG ANSWER, not the trivial one. S52 killed round 1's null
 *           control because its edit changed a constant INSIDE the mix and could not alter spatial
 *           variance at all. The plausible wrong answer here is "just turn the reflection down":
 *           the weight replaced by a CONSTANT with no view-angle dependence at all, set to the
 *           frame-mean weight the round-2 arm actually produces (measured by the probe, passed in
 *           with --nullw). It must NOT satisfy clause (a) and must NOT make FresnelDelta positive.
 *           If it does, then the result is "less reflection", not "angle-dependent reflection",
 *           and the round-2 thesis is wrong.
 *   surface-hidden        POSITIVE CONTROL and the source of the WATER_MASK. Independent of the
 *                         shader arm, so it is captured once per pose and reused.
 *   nothing-restore-control  the floor: the untouched scene re-captured at the end of the run, so
 *                         drift over the run is visible rather than assumed away.
 *
 * The headless GPU process on this box dies after roughly four recompile+readback cycles (round 1
 * recorded six deaths). So: `--only <ids>` runs a subset, and the result JSON is written after
 * EVERY arm rather than at the end.
 *
 * Usage:
 *   node tools/visual/f7-r2-sweep.mjs --out <dir> [--only fixed,prefix] [--nullw 0.086]
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
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/f7-r2/sweep');
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
// The r1 critic's and the r1 builder's own analysis window, kept identical so 0.000485 and 84.961
// are comparable numbers and not merely similar-sounding ones.
const CROP = String(args.crop || '200,760,60,480').split(',').map(Number);
const NULLW = args.nullw === undefined ? 0.086 : Number(args.nullw);
const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
const V = await import(path.join(REPO, 'tools/metrics/lib/vis03.mjs'));

/* ------------------------------------------------------------------------ image helpers ---- */
const readPng = (buf) => PNG.sync.read(buf);
function lumOf(png) {
  const y = new Float32Array(png.width * png.height);
  for (let i = 0, j = 0; i < png.data.length; i += 4, j++) y[j] = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  return { y, w: png.width, h: png.height };
}
const maskOf = (base, hidden, thr = 3) => {
  const m = new Uint8Array(base.y.length); let c = 0;
  for (let i = 0; i < m.length; i++) if (Math.abs(base.y[i] - hidden.y[i]) > thr) { m[i] = 1; c++; }
  return { m, count: c, pct: +(100 * c / m.length).toFixed(2) };
};
const inCrop = (i, w, [x0, x1, y0, y1]) => { const x = i % w, y = (i / w) | 0; return x >= x0 && x < x1 && y >= y0 && y < y1; };

/* ---- r1's UNMASKED top-down estimator, copied verbatim in behaviour from w1-water-lane-pitch.mjs
 *      so its x_rms / lane_power / lane_aniso are the same three numbers, on the same crop. ---- */
function profile1D(o, [x0, x1, y0, y1], axis) {
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
function detrend(p, win) {
  const n = p.length, out = new Float64Array(n), h = Math.max(2, Math.floor(win / 2));
  for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = -h; k <= h; k++) { const j = i + k; if (j < 0 || j >= n) continue; s += p[j]; c++; } out[i] = p[i] - s / c; }
  return out;
}
const rmsOf = (p) => { let m = 0; for (const v of p) m += v; m /= p.length; let s = 0; for (const v of p) s += (v - m) * (v - m); return Math.sqrt(s / p.length); };
function hpRect(o, [x0, x1, y0, y1]) {
  const X1 = Math.min(x1, o.w), Y1 = Math.min(y1, o.h), w = X1 - x0, hh = Y1 - y0, out = new Float32Array(w * hh);
  for (let y = y0; y < Y1; y++) for (let x = x0; x < X1; x++) {
    let s = 0, c = 0; for (let k = -4; k <= 4; k++) { const yy = y + k; if (yy < 0 || yy >= o.h) continue; s += o.y[yy * o.w + x]; c++; }
    out[(y - y0) * w + (x - x0)] = o.y[y * o.w + x] - s / c;
  }
  return { h: out, w, hh };
}
function lanesUnmasked(h, w, hh) {
  const stats = [];
  for (let deg = -90; deg < 90; deg += 2) {
    const th = deg * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th);
    const off = Math.min(0, ux * (w - 1)) + Math.min(0, uy * (hh - 1));
    const nb = Math.ceil(Math.abs(ux) * w + Math.abs(uy) * hh) + 2;
    const acc = new Float64Array(nb), cnt = new Float64Array(nb);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const t = Math.round(ux * x + uy * y - off); if (t < 0 || t >= nb) continue; acc[t] += h[y * w + x]; cnt[t]++; }
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
function r1Estimator(L, crop, mppX = 0.2072, mppZ = 0.2072) {
  const r = hpRect(L, crop), out = lanesUnmasked(r.h, r.w, r.hh);
  for (const [axis, mpp] of [['x', mppX], ['z', mppZ]]) {
    const p = profile1D(L, crop, axis);
    const d = detrend(p, Math.round(60 / mpp));
    out[`${axis}_rms`] = +rmsOf(d).toFixed(3);
  }
  return out;
}

/* ---- the r1 CRITIC's masked estimator, copied in behaviour from f7-critic-reanalyse.mjs, so its
 *      lane_power_normalised 0.000485 and mean_luma 84.961 are comparable numbers. -------------- */
const highpassV = (o) => {
  const out = new Float32Array(o.y.length);
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
    let s = 0, c = 0; for (let k = -4; k <= 4; k++) { const yy = y + k; if (yy < 0 || yy >= o.h) continue; s += o.y[yy * o.w + x]; c++; }
    out[y * o.w + x] = o.y[y * o.w + x] - s / c;
  }
  return out;
};
function maskedBlur(y, mk, w, h, r) {
  const num = new Float32Array(w * h), den = new Float32Array(w * h);
  for (let j = 0; j < w * h; j++) if (mk.m[j]) { num[j] = y[j]; den[j] = 1; }
  const pass = (src, W, H, horiz) => {
    const out = new Float32Array(W * H);
    for (let b = 0; b < (horiz ? H : W); b++) {
      let acc = 0;
      const at = (k) => (horiz ? src[b * W + k] : src[k * W + b]);
      const N = horiz ? W : H;
      for (let k = 0; k <= Math.min(r, N - 1); k++) acc += at(k);
      for (let k = 0; k < N; k++) {
        if (horiz) out[b * W + k] = acc; else out[k * W + b] = acc;
        const add = k + r + 1, sub = k - r;
        if (add < N) acc += at(add);
        if (sub >= 0) acc -= at(sub);
      }
    }
    return out;
  };
  const n2 = pass(pass(num, w, h, true), w, h, false), d2 = pass(pass(den, w, h, true), w, h, false);
  const out = new Float32Array(w * h);
  for (let j = 0; j < w * h; j++) out[j] = d2[j] > 0 ? n2[j] / d2[j] : 0;
  return out;
}
function lanePass(o, mk) {
  const fine = maskedBlur(o.y, mk, o.w, o.h, 7), coarse = maskedBlur(o.y, mk, o.w, o.h, 60);
  const out = new Float32Array(o.y.length);
  for (let i = 0; i < out.length; i++) out[i] = mk.m[i] ? fine[i] - coarse[i] : 0;
  return out;
}
function maskedLanes(o, bp, mk, [x0, x1, y0, y1], meanLuma) {
  const stats = [];
  for (let deg = -90; deg < 90; deg += 2) {
    const th = deg * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th);
    const off = Math.min(0, ux * (x1 - x0 - 1)) + Math.min(0, uy * (y1 - y0 - 1));
    const nb = Math.ceil(Math.abs(ux) * (x1 - x0) + Math.abs(uy) * (y1 - y0)) + 2;
    const acc = new Float64Array(nb), cnt = new Float64Array(nb);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * o.w + x; if (!mk.m[i]) continue;
      const t = Math.round(ux * (x - x0) + uy * (y - y0) - off);
      if (t < 0 || t >= nb) continue;
      acc[t] += bp[i]; cnt[t]++;
    }
    const need = Math.max(8, 0.25 * Math.min(x1 - x0, y1 - y0));
    const prof = []; for (let i = 0; i < nb; i++) if (cnt[i] >= need) prof.push(acc[i] / cnt[i]);
    if (prof.length < 8) continue;
    let m = 0; for (const v of prof) m += v; m /= prof.length;
    let va = 0; for (const v of prof) va += (v - m) ** 2; va /= prof.length;
    stats.push({ deg, va });
  }
  if (!stats.length) return null;
  const sorted = stats.slice().sort((a, b) => b.va - a.va);
  const med = stats.slice().sort((a, b) => a.va - b.va)[Math.floor(stats.length / 2)].va;
  return {
    lane_bearing_screen_deg: sorted[0].deg,
    lane_power: +sorted[0].va.toFixed(4),
    lane_aniso: +(sorted[0].va / Math.max(1e-9, med)).toFixed(2),
    lane_power_normalised: +(sorted[0].va / Math.max(1e-6, meanLuma * meanLuma)).toFixed(6),
  };
}
function maskedStats(o, hp, mk, crop) {
  let n = 0, sumY = 0, sumH = 0, sumH2 = 0;
  for (let i = 0; i < mk.m.length; i++) {
    if (!mk.m[i] || !inCrop(i, o.w, crop)) continue;
    n++; sumY += o.y[i]; sumH += hp[i]; sumH2 += hp[i] * hp[i];
  }
  if (!n) return null;
  const meanY = sumY / n, meanH = sumH / n;
  const bandRms = Math.sqrt(Math.max(0, sumH2 / n - meanH * meanH));
  return { water_px_in_crop: n, mean_luma: +meanY.toFixed(3), band_rms: +bandRms.toFixed(4), band_contrast: +(bandRms / Math.max(1e-6, meanY)).toFixed(5) };
}

/* ------------------------------------------------------------------------ browser setup ---- */
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
if (!site) { console.error(`no Deck setup '${SITE}'`); await g.close(); process.exit(2); }
await g.h('teleport', site.place.x, site.place.z);
await step(40);
await g.h('setWeather', 'clear');
await g.h('setTimeOfDay', TIME);
await step(12);
const snap = await g.h('snapshot');
const [px, py, pz] = snap.player.pos;

/* The HUD region label is a stuck readout (r1 verdict, secondary_observations). Read the ENGINE. */
const regionProbe = () => g.page.evaluate(({ px, pz }) => {
  const R = window.__ENGINE.renderer;
  let byField = null; try { const r = R.field && R.field.regionAt(px, pz); byField = (r && (r.id || r.name)) || null; } catch (e) { byField = 'ERR:' + e.message; }
  let water = null; try { water = window.__HARNESS.getWaterAt(px, pz); } catch (e) { water = 'ERR:' + e.message; }
  return { field_region: byField, getWaterAt: water };
}, { px, pz });

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
const scaleProbe = () => g.page.evaluate(({ px, py, pz, CW, CH }) => {
  const cam = window.__ENGINE.renderer.camera; cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  const proj = (x, y, z) => { const v = new (Object.getPrototypeOf(cam.position).constructor)(x, y, z); v.project(cam); return [(v.x * 0.5 + 0.5) * CW, (-v.y * 0.5 + 0.5) * CH]; };
  const D = 50, a = proj(px, py, pz), bx = proj(px + D, py, pz), bz = proj(px, py, pz + D);
  return { fov: cam.fov, m_per_px_X: +(D / Math.hypot(bx[0] - a[0], bx[1] - a[1])).toFixed(4), m_per_px_Z: +(D / Math.hypot(bz[0] - a[0], bz[1] - a[1])).toFixed(4) };
}, { px, py, pz, CW, CH });

/* ------------------------------------------------------- live shader-arm machinery --------- */
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
    m.customProgramCacheKey = () => `f7-r2:${armId}`; m.needsUpdate = true;
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

/* The two shader expressions, as literal source. `HEAD_W` must appear verbatim in
 * game/src/render/water.js or every arm below is a fiction; it is asserted against the file. */
const HEAD_W = 'vec3 esSurface=mix(esDepth,esReflection,esRefl*uWaterReflectionStrength);';
const R1_BLOCK_HEAD = `float esF0=.02;
        float esRefl=esF0+(1.0-esF0)*pow(1.0-esView,5.0);
        esRefl=max(esRefl,smoothstep(10.0,52.0,length(vViewPosition))*.72*(1.0-esView));`;
const R1_BLOCK_R1 = `float esFresnel=pow(1.0-esView,2.2);
        float esRefl=.25+max(esFresnel,smoothstep(10.0,52.0,length(vViewPosition))*.72*(1.0-esView))*.50;`;
const LAST_STMT = 'outgoingLight+=vec3(.095,.105,.082)*esFoam;';
const waterSrc = fs.readFileSync(path.join(REPO, 'game/src/render/water.js'), 'utf8');

// ORDER MATTERS. The two mesh arms come first because they are the source of the WATER_MASK that
// every later arm's masked statistic and every probe bin is restricted to. They do not depend on
// the water shader (the water is hidden in them), so one capture serves every arm.
const ARMS = [
  { id: 'surface-hidden', kind: 'mesh', include: '^water', exclude: '^water:shoreline:', what: 'POSITIVE CONTROL and WATER_MASK source — the water table hidden' },
  { id: 'water-hidden', kind: 'mesh', include: '^water', exclude: null, what: 'both water classes hidden — the M12 WATER_MASK source and the probe mask' },
  // THE PROBES ARE GREY, AND THEY ARE CALIBRATED IN THEIR OWN RUN. The first version of this tool
  // packed weight/distance/esView into R/G/B and stripped `#include <tonemapping_fragment>` and
  // `<colorspace_fragment>` from the water program. The strips reported 25 substitutions and the
  // rendered image was transformed anyway: a written vec3(.25,.50,.75) read back as (136,199,212)
  // — R alone consistent with sRGB(ACES(.25 x 1.2)) and the other two pulled by channel mixing.
  // ACESFilmicToneMapping (renderer.js:91, exposure .72 at :95) is a MATRIX transform, so a packed
  // three-channel probe is unreadable, but it preserves NEUTRALS (both ACES matrices' rows sum to
  // 1). So every probe writes a GREY, and `probe-ramp` writes a known grey ramp across the frame
  // in the SAME run, giving a measured 960-sample transfer curve to invert the others through.
  // Nothing about the chain has to be guessed, and if the chain ever changes the ramp changes with
  // it. `probe-ramp` must ride in EVERY batch that contains a probe or that batch is uncalibrated.
  { id: 'probe-ramp', kind: 'probe', probe: 'ramp',
    what: 'a known grey ramp: outgoingLight = vec3(gl_FragCoord.x/(W-1)). Measured column by column, this IS the transfer curve from a written value to a stored byte, including tone mapping and colour space, whatever they are',
    edits: [[LAST_STMT, `${LAST_STMT}outgoingLight=vec3(clamp(gl_FragCoord.x/${(CW - 1).toFixed(1)},0.0,1.0));diffuseColor.a=1.0;`]] },
  { id: 'probe-dist', kind: 'probe', probe: 'dist',
    what: 'grey = view distance / 200 m. Geometry, so it is the SAME field on both arms and one capture serves both',
    edits: [[LAST_STMT, `${LAST_STMT}outgoingLight=vec3(clamp(length(vViewPosition)/200.0,0.0,1.0));diffuseColor.a=1.0;`]] },
  { id: 'probe-esview', kind: 'probe', probe: 'esview',
    what: 'grey = esView, the |N.V| the shader itself computes AFTER the ripple normal perturbation. Also arm-independent',
    edits: [[LAST_STMT, `${LAST_STMT}outgoingLight=vec3(esView);diffuseColor.a=1.0;`]] },
  { id: 'probe-w-fixed', kind: 'probe', probe: 'weight',
    what: 'grey = the round-2 composited mix weight esRefl*uWaterReflectionStrength',
    edits: [[LAST_STMT, `${LAST_STMT}outgoingLight=vec3(esRefl*uWaterReflectionStrength);diffuseColor.a=1.0;`]] },
  { id: 'probe-w-prefix', kind: 'probe', probe: 'weight',
    what: 'grey = ROUND 1\'s composited mix weight, same instrument, so the two weight fields differ by nothing but the expression',
    edits: [[R1_BLOCK_HEAD, R1_BLOCK_R1], [LAST_STMT, `${LAST_STMT}outgoingLight=vec3(esRefl*uWaterReflectionStrength);diffuseColor.a=1.0;`]] },
  { id: 'fixed', kind: 'shader', what: 'HEAD — the round-2 Schlick weight, no edit', edits: null },
  { id: 'prefix', kind: 'shader', what: 'round 1 as shipped (b0f3224e): weight = .25 + max(pow(1-esView,2.2), smoothstep(10,52,d)*.72*(1-esView)) * .50',
    edits: [[R1_BLOCK_HEAD, R1_BLOCK_R1]] },
  { id: 'null-uniform-dim', kind: 'null-control',
    what: `THE PLAUSIBLE WRONG ANSWER: the weight replaced by the CONSTANT ${NULLW} — the same average amount of reflection as the round-2 arm, with no view-angle dependence whatsoever. If this also earns clause (a) or a positive FresnelDelta then the result is "less reflection", not "Fresnel", and the round-2 thesis is wrong`,
    edits: [[R1_BLOCK_HEAD, `float esRefl=${NULLW.toFixed(4)};`]] },
  { id: 'nothing-restore-control', kind: 'mesh', include: '^__none__', exclude: null, what: 'the floor: untouched, captured last, so run drift is measured rather than assumed' },
];
const ONLY = args.only ? String(args.only).split(',') : null;
// The two mask arms and the floor ride in EVERY batch (no later arm is readable without them), and
// so does `fixed`: it costs no recompile and it makes every batch carry its own reference arm, so
// prefix-vs-fixed is always a WITHIN-process comparison however the batches are cut.
const ALWAYS = ['surface-hidden', 'water-hidden', 'fixed', 'nothing-restore-control'];
const SELECTED = ONLY ? ARMS.filter((a) => ONLY.includes(a.id) || ALWAYS.includes(a.id)) : ARMS;
const POSE_FILTER = args.poses ? String(args.poses).split(',') : null;

// The four poses a player actually occupies plus the two the r1 work argued over. The r1 verdict's
// finding was that the whole visible effect of round 1 lived at `topdown-120`, a camera the game
// never puts anyone in, while `c-vista`, `e-eye` and `h-grazing` moved by +0.8%, -0.3%, -0.4%.
const POSES = [
  { id: 'topdown-120', run: () => topdown(120), why: "r1's own pose — straight down at 120 m; clause (a) case 1, clause (c), clause (d)" },
  { id: 'b-pitch-55-d50', run: () => pose(90, -55, 50), why: 'half-way down' },
  { id: 'c-vista-11-d26', run: () => pose(Number(site.camera.yaw_deg ?? 90), -11, 26), why: 'the deck vista pose — what a player judges the world by, and the r1 critic\'s M12 pose' },
  { id: 'd-water-edge', run: () => pose(Number(site.camera.yaw_deg ?? 90), -4, 14), stills: 'edge-still', why: 'the water_edge shot clause (b) names: low over the water with bank and sky above the waterline, so ReflCorr and NormalEnergy are obtainable' },
  { id: 'e-eye-yaw090', run: () => pose(90, -8, 7), why: 'eye level — water as a player meets it' },
  { id: 'h-grazing-2', run: () => pose(45, -2, 12), why: 'nearly on the surface — the case the round-1 fix deliberately did not move' },
].filter((p) => !POSE_FILTER || POSE_FILTER.includes(p.id));

const out = {
  tool: 'f7-r2-sweep', site: SITE, generated: new Date().toISOString(), seed: SEED, time_of_day: TIME,
  canvas: [CW, CH], crop: CROP, null_control_constant: NULLW, commit: null,
  player: [+px.toFixed(2), +py.toFixed(2), +pz.toFixed(2)],
  deck_declared_region: site.region, region_probe: await regionProbe(),
  head_expression_asserted: waterSrc.includes(HEAD_W) && waterSrc.includes('float esF0=.02;')
    ? 'PASS — game/src/render/water.js contains the round-2 weight verbatim'
    : 'FAIL — game/src/render/water.js does NOT contain the round-2 weight; every arm below is a fiction',
  arms: {}, checks: {}, pageErrors: [],
};
try { out.commit = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim(); } catch { /* detached or no git */ }
const write = () => fs.writeFileSync(path.join(OUT, 'sweep.json'), JSON.stringify(out, null, 2));
write();
console.log(out.head_expression_asserted);
console.log(`region (from the ENGINE, not the HUD label): ${JSON.stringify(out.region_probe)}`);

/* A probe pixel is a WATER-TABLE pixel: it differs from the water-hidden frame at the same pose
 * (so it is water at all) AND the shoreline band mesh draws nothing there (so no second,
 * unprobed transparent layer is blended over the value being read). Both conditions come from
 * frames, not from a claim about the scene graph. */
function probeMask(png, hid, sur) {
  const N = png.width * png.height, m = new Uint8Array(N);
  let n = 0;
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const isWater = Math.abs(png.data[p] - hid.data[p]) + Math.abs(png.data[p + 1] - hid.data[p + 1]) + Math.abs(png.data[p + 2] - hid.data[p + 2]) > 6;
    if (!isWater) continue;
    if (sur) {
      const shore = Math.abs(sur.data[p] - hid.data[p]) + Math.abs(sur.data[p + 1] - hid.data[p + 1]) + Math.abs(sur.data[p + 2] - hid.data[p + 2]);
      if (shore > 2) continue;
    }
    m[i] = 1; n++;
  }
  return { m, n };
}
/** The measured transfer curve: for each written value v = x/(W-1), the mean stored byte over the
 *  water pixels in that column. Returned as a monotone-cleaned pair of arrays for inversion. */
function rampCurve(png, mk) {
  const W = png.width, H = png.height, sum = new Float64Array(W), cnt = new Float64Array(W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (mk.m[i]) { sum[x] += png.data[i * 4]; cnt[x]++; } }
  const xs = [], ys = [];
  for (let x = 0; x < W; x++) if (cnt[x] >= 20) { xs.push(x / (W - 1)); ys.push(sum[x] / cnt[x]); }
  // enforce monotone non-decreasing in the stored byte, so the inverse is single-valued
  for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1]) ys[i] = ys[i - 1];
  return { in: xs, out: ys, columns_used: xs.length, span_bytes: ys.length ? +(ys[ys.length - 1] - ys[0]).toFixed(1) : 0 };
}
/** Invert a stored byte back to the value that was written, through the measured curve. */
function makeDecoder(curve) {
  if (!curve || curve.in.length < 32) return null;
  const { in: xs, out: ys } = curve;
  return (byte) => {
    if (byte <= ys[0]) return xs[0];
    if (byte >= ys[ys.length - 1]) return xs[xs.length - 1];
    let lo = 0, hi = ys.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ys[mid] <= byte) lo = mid; else hi = mid; }
    const t = (byte - ys[lo]) / Math.max(1e-9, ys[hi] - ys[lo]);
    return xs[lo] + t * (xs[hi] - xs[lo]);
  };
}
function quantiles(vals) {
  if (!vals.length) return { n: 0, note: 'no pixel matched this bin' };
  vals.sort((a, b) => a - b);
  const q = (f) => +vals[Math.min(vals.length - 1, Math.floor(f * vals.length))].toFixed(4);
  return { n: vals.length, mean: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4), p05: q(0.05), median: q(0.5), p95: q(0.95) };
}

const maskSrc = {};     // pose -> lum of the surface-hidden frame (water table's own pixels)
const maskSrcPng = {};  // pose -> png of the surface-hidden frame (to exclude shoreline pixels)
const waterHidSrc = {}; // pose -> png of the water-hidden frame
const ramp = {};        // pose -> the measured transfer curve, THIS run
const probeField = {};  // 'dist:<pose>' / 'esview:<pose>' / 'weight:<pose>' -> decoded field

for (const arm of SELECTED) {
  const row = { what: arm.what, kind: arm.kind, poses: {} };
  if (arm.kind === 'shader' || arm.kind === 'null-control' || arm.kind === 'probe') {
    if (arm.edits) {
      await applyEdits(arm.id, arm.edits); await step(8);
      row.edits_applied = await editCount();
      row.edits_expected = arm.edits.length;
      if (!row.edits_applied) { row.VACUOUS = 'FAIL — the arm matched nothing. Not a result.'; out.arms[arm.id] = row; write(); continue; }
    }
  } else {
    row.meshes_hidden = await hideClass(arm.include, arm.exclude); await step(6);
  }

  for (const p of POSES) {
    await p.run(); await step(8);
    if (p.id === 'topdown-120' && !out.scale) out.scale = await scaleProbe();
    const buf = await shot(`${arm.id}-${p.id}`);
    const png = readPng(buf), L = lumOf(png);
    const cell = { why: p.why };

    if (arm.kind === 'probe') {
      const hid = waterHidSrc[p.id] || null, sur = maskSrcPng[p.id] || null;
      if (!hid) { cell.probe = { VOID: 'no water-hidden frame for this pose; a probe cannot be masked and is not a result' }; }
      else {
        const mk = probeMask(png, hid, sur);
        if (arm.probe === 'ramp') { ramp[p.id] = rampCurve(png, mk); cell.probe = { water_px: mk.n, curve: ramp[p.id] }; }
        else {
          const dec = makeDecoder(ramp[p.id]);
          if (!dec) cell.probe = { VOID: 'no calibration ramp captured for this pose in THIS run; the byte cannot be turned back into a written value' };
          else {
            const vals = [];
            for (let i = 0; i < mk.m.length; i++) if (mk.m[i]) vals.push(dec(png.data[i * 4]));
            cell.probe = { water_px: mk.n, decoded_through: 'probe-ramp, this run, this pose', all_water: quantiles(vals.slice()) };
            probeField[`${arm.probe}:${p.id}`] = { mask: mk, vals: Float32Array.from(vals), idx: (() => { const a = []; for (let i = 0; i < mk.m.length; i++) if (mk.m[i]) a.push(i); return a; })() };
            // Clause (a) bins, IF the distance and esView fields have been captured this run.
            const D = probeField[`dist:${p.id}`], E = probeField[`esview:${p.id}`];
            if (arm.probe === 'weight' && D && E) {
              const dAt = new Float32Array(mk.m.length), vAt = new Float32Array(mk.m.length);
              const dHas = new Uint8Array(mk.m.length), vHas = new Uint8Array(mk.m.length);
              D.idx.forEach((i, k) => { dAt[i] = D.vals[k] * 200; dHas[i] = 1; });
              E.idx.forEach((i, k) => { vAt[i] = E.vals[k]; vHas[i] = 1; });
              const bin = (sel) => { const o = []; for (let k = 0; k < probeField[`${arm.probe}:${p.id}`].idx.length; k++) { const i = probeField[`${arm.probe}:${p.id}`].idx[k]; if (!dHas[i] || !vHas[i]) continue; if (sel(dAt[i], vAt[i])) o.push(probeField[`${arm.probe}:${p.id}`].vals[k]); } return quantiles(o); };
              cell.probe.bins = {
                near_normal_esView_gt_0_90: bin((d, v) => v > 0.90),
                dist_110_130_m: bin((d) => d >= 110 && d <= 130),
                dist_55_65_m: bin((d) => d >= 55 && d <= 65),
                dist_55_65_m_grazing_esView_lt_0_20: bin((d, v) => d >= 55 && d <= 65 && v < 0.20),
                grazing_esView_lt_0_20_any_dist: bin((d, v) => v < 0.20),
              };
            } else if (arm.probe === 'weight') {
              cell.probe.bins = { NOT_BINNED: 'the dist and esView probe fields were not captured in this batch; run --only probe-ramp,probe-dist,probe-esview,probe-w-fixed,probe-w-prefix to bin' };
            }
          }
        }
      }
    } else {
      // the r1 UNMASKED estimator: all three of its numbers, always.
      if (p.id === 'topdown-120') cell.r1_unmasked = r1Estimator(L, CROP);
      // the r1-critic MASKED estimator, once a mask exists for this pose.
      if (maskSrc[p.id]) {
        const mk = maskOf(L, maskSrc[p.id]);
        const st = maskedStats(L, highpassV(L), mk, CROP);
        cell.masked = { water_mask_pct_of_frame: mk.pct, ...st };
        if (st) {
          const bp = lanePass(L, mk);
          cell.masked.lanes_on_water = maskedLanes(L, bp, mk, CROP, st.mean_luma);
        }
      }
      // M12, whenever the water-hidden frame for this pose exists.
      if (waterHidSrc[p.id]) {
        const hid = waterHidSrc[p.id];
        const N = png.width * png.height, water = new Uint8Array(N);
        let wn = 0;
        for (let i = 0, q = 0; i < N; i++, q += 4) {
          const d = Math.abs(png.data[q] - hid.data[q]) + Math.abs(png.data[q + 1] - hid.data[q + 1]) + Math.abs(png.data[q + 2] - hid.data[q + 2]);
          if (d > 6) { water[i] = 1; wn++; }
        }
        const seq = [];
        const stillTag = p.id === 'c-vista-11-d26' ? 'motion-still' : (p.stills || null);
        if (stillTag) {
          for (let i = 0; i < 5; i++) { await step(3); const b2 = await shot(`${arm.id}-${stillTag}-${i}`); seq.push(V.prepare(readPng(b2)).Yp); }
        }
        const m12 = V.M12(V.prepare(png), water, { sequence: seq });
        const verdict = {};
        for (const [k, band] of Object.entries(V.M12_BANDS)) {
          const v = m12[k];
          verdict[k] = (v === null || v === undefined) ? 'UNMEASURABLE (0 fail-closed)' : (v >= band.min ? `PASS (>= ${band.min})` : `FAIL (< ${band.min})`);
        }
        cell.m12 = {
          water_mask_px: wn, water_mask_pct: +(100 * wn / N).toFixed(2), sequence_frames: seq.length,
          values: Object.fromEntries(Object.entries(m12).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(5) : v])),
          band_verdict: verdict,
        };
      }
    }
    row.poses[p.id] = cell;
    // Written after EVERY pose, not at the end (HAZARDS §18: a report written once at the end is a
    // report that a GPU death deletes).
    out.arms[arm.id] = row; write();
    const brief = cell.probe ? `probe ${cell.probe.all_water ? 'mean ' + cell.probe.all_water.mean : (cell.probe.curve ? 'ramp cols ' + cell.probe.curve.columns_used : JSON.stringify(cell.probe).slice(0, 60))}` : (cell.masked ? `luma ${cell.masked.mean_luma} lanepow_n ${cell.masked.lanes_on_water?.lane_power_normalised}` : (cell.r1_unmasked ? `x_rms ${cell.r1_unmasked.x_rms}` : ''));
    process.stderr.write(`${arm.id}/${p.id}: ${brief}\n`);
  }

  // The two mask sources are captured with the water hidden and are therefore identical whatever
  // the water shader is doing; captured once, reused by every later arm.
  if (arm.id === 'surface-hidden') for (const p of POSES) { const g2 = readPng(fs.readFileSync(path.join(OUT, 'frames', `${arm.id}-${p.id}.png`))); maskSrcPng[p.id] = g2; maskSrc[p.id] = lumOf(g2); }
  if (arm.id === 'water-hidden') for (const p of POSES) waterHidSrc[p.id] = readPng(fs.readFileSync(path.join(OUT, 'frames', `${arm.id}-${p.id}.png`)));

  if (arm.kind === 'mesh') await unhide(); else if (arm.edits) await restoreEdits();
  await step(6);
}

/* ------------------------------------------------------------------------------- the checks */
// Frames renamed into the shape `tools/visual/f7-critic-m12-offline.mjs` expects, so the r1
// critic's own command runs verbatim against this run's output and does not have to be trusted
// second-hand: `node tools/visual/f7-critic-m12-offline.mjs --dir <out>`.
for (const armId of ['prefix', 'fixed', 'null-uniform-dim']) {
  for (const p of POSES) {
    const src = path.join(OUT, 'frames', `water-hidden-${p.id}.png`);
    const dst = path.join(OUT, 'frames', `${armId}-${p.id}-water-hidden.png`);
    if (fs.existsSync(src) && fs.existsSync(path.join(OUT, 'frames', `${armId}-${p.id}.png`))) fs.copyFileSync(src, dst);
  }
}

const A = out.arms;
const rampTd = A['probe-ramp']?.poses?.['topdown-120']?.probe?.curve;
out.checks['PROBE-IS-CALIBRATED'] = !rampTd ? 'NOT RUN — no probe row in this batch may be read as a weight'
  : (rampTd.columns_used >= 400 && rampTd.span_bytes >= 120
    ? `PASS — the grey ramp was resolved over ${rampTd.columns_used} columns spanning ${rampTd.span_bytes} stored bytes, so a byte inverts to a written value`
    : `FAIL — the ramp resolved only ${rampTd.columns_used} columns spanning ${rampTd.span_bytes} bytes; the inverse is not usable and every weight row in this batch is void`);
// The round-trip: decode the ramp frame through its OWN curve and check it returns the ramp.
if (rampTd && rampTd.in.length > 64) {
  const dec = makeDecoder(rampTd);
  let worst = 0;
  for (let k = 0; k < rampTd.in.length; k++) worst = Math.max(worst, Math.abs(dec(rampTd.out[k]) - rampTd.in[k]));
  out.checks['PROBE-ROUND-TRIP'] = worst <= 0.01
    ? `PASS — worst round-trip error over the ramp is ${worst.toFixed(4)} in written-value units`
    : `FAIL — worst round-trip error ${worst.toFixed(4)}; the curve is not invertible to the precision the clause needs`;
}
out.pageErrors = g.errors.slice(0, 20);
write();
console.log('\n' + Object.entries(out.checks).map(([k, v]) => `${k}: ${v}`).join('\n'));
console.log(`\nwrote ${path.join(OUT, 'sweep.json')}`);
await g.close();
