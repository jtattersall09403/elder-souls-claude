#!/usr/bin/env node
/**
 * w1-water-lane-terms.mjs — WHICH TERM of the water shader owns the marsh lanes?
 *
 * BACKGROUND. `W1-30-SHADOW-CASTERS-r1` proved the long-standing light/dark lanes across the
 * marshes are not a shadow artefact: they are 0.67-0.84 self-similar from 08:00 to 19:30 (a
 * sun-driven pattern cannot be), turning every shadow off leaves them at rho 0.990 against a
 * 0.957 restore-control floor, and hiding the water collapses them to rho 0.335 and removes 42%
 * of their energy. That names the FILE (`game/src/render/water.js`). It does not name the TERM,
 * and `water.js`'s own header claims a crossed incommensurate wave field already removed
 * "the axis-aligned 20 m light/dark lanes". The lanes are still there, so the header is wrong
 * about something and this tool is how we find out about what.
 *
 * THE METHOD. One page, one world, one camera. For each arm we rewrite ONE term of the live
 * water shader by string substitution on the source `water.js` emits, bump the program cache key
 * so three.js cannot hand back the cached program, force a recompile, and re-shoot the identical
 * frame. The arm whose band energy collapses owns the lanes. Every arm is undone and the next is
 * applied to the restored baseline, and a `nothing` arm re-shoots the untouched frame at the end
 * so the site's own nondeterminism floor is measured rather than assumed.
 *
 * WHY STRING SUBSTITUTION ON THE LIVE SHADER RATHER THAN A CLONE PER ARM. A control clone per arm
 * is ten page loads and ten world builds for a question that is answered by ten recompiles of one
 * material. The risk it carries is that a substitution silently matches nothing and the arm is a
 * second copy of the baseline (RULES rule 6, the inert control). So every arm ASSERTS its own
 * substitution count in the page and reports it: an arm with `edits_applied: 0` is printed as
 * VACUOUS and is not allowed to be read as a negative result.
 *
 * GUARDS, and they are two-sided (HAZARDS.md 0b — a guard that can only see the direction its
 * author expected fails on half the number line):
 *   - `water-hidden` is carried as a POSITIVE control. It is the arm the critic already showed
 *     goes red. If it does not go red HERE, this run's instrument is broken and every other row
 *     is void. Reported as INSTRUMENT-CAN-SEE-LANES.
 *   - `nothing` is the restore control and sets the floor.
 *   - Every arm is classified against that floor in BOTH directions: an arm that RAISES band
 *     energy is flagged just as loudly as one that lowers it.
 *   - `shadows-off` is re-run here, with a whole-frame change fraction alongside it, because an
 *     arm that turns nothing off looks exactly like an arm that changes nothing.
 *
 * Usage:
 *   node tools/visual/w1-water-lane-terms.mjs                      # vista-deep-marshes, 13:00
 *   node tools/visual/w1-water-lane-terms.mjs --site eye-blackwood --crop 60,420,300,500
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
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/water-lane-terms/${SITE}`);
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
// Crop is pre-registered per site off the committed hardware stills, before any arm is run.
const DEFAULT_CROP = { 'vista-deep-marshes': '560,900,300,470', 'eye-blackwood': '60,420,300,500' };
const CROP = String(args.crop || DEFAULT_CROP[SITE] || '560,900,300,470').split(',').map(Number);

const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));

function lum(buf) {
  const p = PNG.sync.read(buf);
  const y = new Float32Array(p.width * p.height);
  for (let i = 0, j = 0; i < p.data.length; i += 4, j++) {
    y[j] = 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2];
  }
  return { y, w: p.width, h: p.height };
}
/** Vertical high-pass over the crop. Identical to the r1 critic's, so the numbers are comparable. */
function hp(o, [x0, x1, y0, y1]) {
  const out = [];
  for (let y = y0; y < Math.min(y1, o.h); y++) {
    for (let x = x0; x < Math.min(x1, o.w); x++) {
      let s = 0, c = 0;
      for (let k = -4; k <= 4; k++) { const yy = y + k; if (yy < 0 || yy >= o.h) continue; s += o.y[yy * o.w + x]; c++; }
      out.push(o.y[y * o.w + x] - s / c);
    }
  }
  return out;
}
function corr(a, b) {
  const n = Math.min(a.length, b.length);
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sa = 0, sb = 0, sab = 0;
  for (let i = 0; i < n; i++) { const u = a[i] - ma, v = b[i] - mb; sa += u * u; sb += v * v; sab += u * v; }
  return +(sab / Math.sqrt(sa * sb)).toFixed(3);
}
function energy(h) { let s = 0; for (const v of h) s += Math.abs(v); return +(s / h.length).toFixed(3); }

/* --- the lane metric, and why `energy` above is not enough ------------------------------------
 * `energy` is the r1 critic's statistic and is kept so the numbers stay comparable. It is a mean
 * absolute vertical high-pass over a crop, and at `vista-deep-marshes` that crop is full of tree
 * trunks and roots: measured, it RISES 19% when the whole water surface is replaced by one flat
 * colour, because the crop's high-frequency content is mostly trees and flattening the water only
 * changes their contrast against it. A statistic that goes up when the thing under test is deleted
 * is not measuring the thing under test.
 *
 * `lanes()` measures banding directly and directionally. The crop is high-passed, then projected
 * onto an axis at each angle; a set of parallel lanes concentrates all its variance at ONE angle
 * (the one perpendicular to the lanes) and almost none at the angle along them. So:
 *   lane_power  variance of the projection profile at the best angle — how strong the banding is
 *   lane_angle  the angle it sits at, in screen degrees; lanes that move are lanes that changed
 *   lane_aniso  best angle's variance / the median angle's — how BANDED rather than merely noisy
 *               the crop is. Isotropic noise gives ~1. This is the number an arm has to move.
 * `lane_aniso` is a ratio, so it is immune to the confound that killed `energy` here: an arm that
 * makes the whole crop brighter or flatter scales numerator and denominator together. */
function lanes(h, w, hh) {
  const at = (x, y) => h[y * w + x];
  const stats = [];
  for (let deg = -90; deg < 90; deg += 2) {
    const th = deg * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th);
    const off = Math.min(0, ux * (w - 1)) + Math.min(0, uy * (hh - 1));
    const nb = Math.ceil(Math.abs(ux) * w + Math.abs(uy) * hh) + 2;
    const acc = new Float64Array(nb), cnt = new Float64Array(nb);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const t = Math.round(ux * x + uy * y - off); if (t < 0 || t >= nb) continue; acc[t] += at(x, y); cnt[t]++; }
    // Only bins with enough support, so the thin corners of a rotated projection cannot dominate.
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
  return {
    lane_power: +sorted[0].va.toFixed(3),
    lane_angle: sorted[0].deg,
    lane_aniso: +(sorted[0].va / Math.max(1e-6, med)).toFixed(2),
  };
}
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
/** Whole-frame change fraction — so an arm that turned nothing off is distinguishable from an
 *  arm that changed nothing inside the crop but plenty outside it. */
function changed(a, b) {
  const A = lum(a), B = lum(b); let n = 0;
  for (let i = 0; i < A.y.length; i++) if (Math.abs(A.y[i] - B.y[i]) > 2) n++;
  return +(100 * n / A.y.length).toFixed(2);
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
const c = s.camera;
const yaw = (c.yaw_deg || 0) * Math.PI / 180, pitch = (c.pitch_deg || 0) * Math.PI / 180;
const height = c.height_m || 1.7, fwd = 60;
await g.h('camera', { pos: [px, py + height, pz], look: [px + Math.sin(yaw) * fwd, py + height + Math.tan(pitch) * fwd, pz + Math.cos(yaw) * fwd] });
await g.h('setWeather', 'clear');
await g.h('setTimeOfDay', TIME);
await step(20);

async function shot(name) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(OUT, 'frames', `${name}.png`), buf);
  return buf;
}

/* ---------------------------------------------------------------------------------------------
 * The shader-term editor. `edits` is a list of [needle, replacement]; both are literal strings
 * lifted verbatim from `render/water.js`, so a needle that stops matching means water.js changed
 * under this tool and the arm reports 0 edits rather than quietly passing.
 * ------------------------------------------------------------------------------------------- */
const applyEdits = (armId, edits) => g.page.evaluate(({ armId, edits }) => {
  const R = window.__ENGINE.renderer;
  const mats = new Set();
  R.scene.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) if (m && m.userData && m.userData.waterUniforms) mats.add(m);
  });
  let applied = 0, materials = 0;
  for (const m of mats) {
    if (!m.__laneOrigOBC) { m.__laneOrigOBC = m.onBeforeCompile; m.__laneOrigKey = m.customProgramCacheKey; }
    m.onBeforeCompile = function (shader, renderer) {
      m.__laneOrigOBC.call(this, shader, renderer);
      for (const [needle, rep, where] of edits) {
        const target = (where === 'vertex') ? 'vertexShader' : 'fragmentShader';
        if (shader[target].includes(needle)) { shader[target] = shader[target].split(needle).join(rep); window.__LANE_EDITS++; }
      }
    };
    m.customProgramCacheKey = () => `w1-water-lane-terms:${armId}`;
    m.needsUpdate = true;
    materials++;
  }
  window.__LANE_EDITS = 0;
  window.__LANE_MATS = mats;
  return { materials };
}, { armId, edits });

/** Read back how many substitutions actually landed once the programs have recompiled. */
const editCount = () => g.page.evaluate(() => window.__LANE_EDITS || 0);

const restoreEdits = () => g.page.evaluate(() => {
  for (const m of (window.__LANE_MATS || [])) {
    if (m.__laneOrigOBC) { m.onBeforeCompile = m.__laneOrigOBC; m.customProgramCacheKey = m.__laneOrigKey; m.needsUpdate = true; }
  }
  window.__LANE_MATS = new Set();
});

const hide = (prefixes) => g.page.evaluate(({ prefixes }) => {
  const R = window.__ENGINE.renderer;
  window.__LANE_HIDDEN = [];
  let hidden = 0;
  R.scene.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh) || !o.visible) return;
    const n = o.name || '';
    if (!prefixes.some((p) => n === p || n.startsWith(p))) return;
    window.__LANE_HIDDEN.push(o); o.visible = false; hidden++;
  });
  return hidden;
}, { prefixes });
const unhide = () => g.page.evaluate(() => { for (const o of (window.__LANE_HIDDEN || [])) o.visible = true; window.__LANE_HIDDEN = []; });
const setFeature = (n, o) => g.page.evaluate(({ n, o }) => window.__ENGINE.renderer.sky.setFeature(n, o), { n, o });
const shadowReport = () => g.page.evaluate(() => {
  const sky = window.__ENGINE.renderer.sky;
  return { castShadow: sky.sun.castShadow, feature: sky.features.shadows, intensity: +sky.sun.intensity.toFixed(3) };
});
/** What the water actually is, asked of the page rather than inferred from the source. */
const waterState = () => g.page.evaluate(() => {
  const R = window.__ENGINE.renderer;
  const out = { meshes: 0, geometries: [], materials: [] };
  const seenMat = new Set();
  R.scene.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh)) return;
    if (!/^water/.test(o.name || '')) return;
    out.meshes++;
    if (out.geometries.length < 3) {
      out.geometries.push({ name: o.name, attributes: Object.keys(o.geometry.attributes), visible: o.visible, renderOrder: o.renderOrder });
    }
    const m = o.material;
    if (m && !seenMat.has(m.uuid) && out.materials.length < 4) {
      seenMat.add(m.uuid);
      out.materials.push({
        type: m.type, transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite,
        vertexColors: m.vertexColors, hasMap: !!m.map, hasNormalMap: !!m.normalMap,
        transmission: m.transmission, clearcoat: m.clearcoat,
        reflectionStrength: m.userData?.waterUniforms?.uWaterReflectionStrength?.value,
        reflectionBound: !!m.userData?.waterUniforms?.uWaterReflection?.value,
      });
    }
  });
  out.shadow = { castShadow: R.sky.sun.castShadow, feature: R.sky.features.shadows, report: R.sky.shadowReport ? R.sky.shadowReport() : null };
  return out;
});

/* --- the arms -------------------------------------------------------------------------------
 * Each entry names ONE mechanism in water.js. The needles are literal source from that file.
 */
const E = (needle, rep, where) => [needle, rep, where || 'fragment'];

const ALL_ARMS = [
  // ---- positive control: the arm the r1 critic already showed goes red -----------------------
  { id: 'water-hidden', kind: 'positive-control',
    what: 'hide every water mesh — the arm the r1 critic ran; must go red or this run is void',
    run: async () => ({ hidden: await hide(['water', 'province-water', 'water-']) }), undo: unhide },

  // ---- the shader terms, most-suspected first -----------------------------------------------
  { id: 'fresnel-slope-zero', kind: 'term',
    what: 'esSlope -> 0: the crossed-wave normal perturbation that drives esFresnel and warps the reflection lookup',
    edits: [E('normal=normalize(normal+vec3(esSlope.x,0.0,esSlope.y));', 'normal=normalize(normal);')] },
  { id: 'grazing-const', kind: 'term',
    what: 'esGrazing -> 0.5 constant: removes BOTH the Fresnel swing and the distance smoothstep from the reflection weight',
    edits: [E('float esGrazing=max(esFresnel,smoothstep(10.0,52.0,length(vViewPosition))*.72);', 'float esGrazing=0.5;')] },
  { id: 'vertexwave-zero', kind: 'term',
    what: 'vEsWaterWave -> 0: kills the 1.8 cm vertex displacement and the 0.8% diffuse modulation sampled on the 12.5 m water lattice',
    edits: [E('vEsWaterWave=sin(esA)*.48+sin(esB)*.36+sin(esC)*.16;', 'vEsWaterWave=0.0;', 'vertex')] },
  { id: 'fine-additive-zero', kind: 'term',
    what: 'the caustic/shimmer/pulse/ripple/capillary/micro additive line -> nothing',
    edits: [E('outgoingLight+=vec3(.006,.010,.011)*esCaustic', 'outgoingLight+=0.0*vec3(.006,.010,.011)*esCaustic')] },
  { id: 'shore-zero', kind: 'term',
    what: 'esShore -> 0: kills the 12.5 m-lattice shoreline darkening and the foam band',
    edits: [E('float esShore=smoothstep(.04,.92,vEsWaterShore);', 'float esShore=0.0;')] },
  { id: 'reflection-flat', kind: 'term',
    what: 'esReflection -> a flat sky colour: keeps the reflection weight, removes the reflected image',
    edits: [E('esReflection=mix(esReflection,esScreenReflection,.62);', 'esReflection=esSky;')] },

  // ---- the plausible-wrong-answer null control ----------------------------------------------
  // NOT "turn the water off" (that is a diagnosis, and it is the positive control above). This
  // changes what the water LOOKS like — its depth colour and its wave amplitude — without
  // touching the geometry of the wave field. HAZARDS 0/0b: the control has to be the answer a
  // careless fix would give, and it must NOT remove the lanes.
  { id: 'null-recolour-and-amplitude', kind: 'null-control',
    what: 'depth colour changed and every wave amplitude halved — a visible change to the water that does not touch the lanes geometry; MUST NOT fix them',
    edits: [
      E('vec3 esDepth=vec3(.038,.105,.118)+diffuseColor.rgb*.21;', 'vec3 esDepth=vec3(.140,.070,.055)+diffuseColor.rgb*.21;'),
      E('vec2 esSlope=vec2(cos(esA)*.030-cos(esB)*.019+cos(esC)*.012+cos(esD)*.010,\n                          cos(esA)*.022+cos(esB)*.031-cos(esC)*.010+cos(esD)*.007);',
        'vec2 esSlope=vec2(cos(esA)*.015-cos(esB)*.0095+cos(esC)*.006+cos(esD)*.005,\n                          cos(esA)*.011+cos(esB)*.0155-cos(esC)*.005+cos(esD)*.0035);'),
    ] },

  // ---- the shadow arm, re-run, with a whole-frame witness -------------------------------------
  { id: 'shadows-off', kind: 'cross-check',
    what: 're-run of the r1 critic shadow arm, this time with a whole-frame change fraction so an inert arm is visible',
    // `sky.features.shadows` is consumed at sky.js:821, inside `Sky.apply()`, which runs on EVERY
    // render — proven the hard way: an earlier version of this arm made `sun.castShadow`
    // non-writable and line 821 threw on the next frame. So the flag does reach the light. The
    // report is therefore read AFTER the settle step, not before it, because read before any
    // render it always shows the previous frame's value and an inert arm and a live one look alike.
    run: async () => { await setFeature('shadows', false); await step(4); return { feature: 'shadows=false', shadow_report_after_step: await shadowReport() }; },
    undo: async () => setFeature('shadows', true) },

  // ---- round two: is the water even the surface the lanes are painted on? ----------------------
  // Round one ablated every term water.js contributes and none of them moved the lanes, while
  // hiding the water still collapses them. Those two facts cannot both be about water.js's shader,
  // so these arms test the two remaining routes into a water pixel: the standard three.js lighting
  // that survives the final mix (which is where a cast shadow would arrive), and `diffuseColor`
  // (which is where the 12.5 m water lattice's vertex colour arrives).
  { id: 'flat-water', kind: 'mechanism',
    what: 'the ENTIRE water output replaced by one constant colour. If the lanes survive this they are not painted on the water at all, whatever hiding the water does',
    edits: [E('outgoingLight=mix(outgoingLight,esSurface,.68);', 'outgoingLight=vec3(.28,.36,.35);')] },
  { id: 'no-standard-lighting', kind: 'mechanism',
    what: 'the final mix weight taken to 1.0, discarding the 32% of three.js standard lighting that carries the sun shadow into the water pixel',
    edits: [E('outgoingLight=mix(outgoingLight,esSurface,.68);', 'outgoingLight=esSurface;')] },
  { id: 'diffuse-const', kind: 'mechanism',
    what: 'diffuseColor forced constant, which removes the water geometry vertex colour (the 12.5 m per-cell depth ramp) and the base map together',
    edits: [E('diffuseColor.rgb*=1.015+vEsWaterWave*.008;', 'diffuseColor.rgb=vec3(.14,.30,.32);')] },

  { id: 'nothing-restore-control', kind: 'floor', what: 'nothing — the site nondeterminism floor', run: async () => ({}), undo: async () => {} },
];
const ONLY = args.only ? String(args.only).split(',') : null;
// The floor and the positive control are never dropped: without them no other row can be read.
const ARMS = ONLY ? ALL_ARMS.filter((a) => ONLY.includes(a.id) || a.kind === 'floor' || a.kind === 'positive-control') : ALL_ARMS;

const base = await shot('00-baseline');
const baseL = lum(base);
const baseH = hp(baseL, CROP);
const baseR = hpRect(baseL, CROP);
const out = {
  tool: 'w1-water-lane-terms', site: SITE, time: TIME, crop: CROP, canvas: [CW, CH], seed: SEED,
  commit: null, baseline_band_energy: energy(baseH), baseline_lane: lanes(baseR.h, baseR.w, baseR.hh),
  arms: [], pageErrors: [],
};
console.log(`baseline lanes: ${JSON.stringify(out.baseline_lane)}`);
try { out.commit = (await import('node:child_process')).execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim(); } catch {}
out.water_state = await waterState();
console.log(`water state: ${JSON.stringify(out.water_state, null, 1)}`);
console.log(`site ${SITE} t${TIME}  baseline band energy ${out.baseline_band_energy}  crop ${CROP.join(',')}`);

for (const arm of ARMS) {
  let applied = {};
  if (arm.edits) { applied = await applyEdits(arm.id, arm.edits); }
  else if (arm.run) { applied = await arm.run(); }
  await step(4);
  const buf = await shot(arm.id);
  if (arm.edits) applied.edits_applied = await editCount();
  const L = lum(buf);
  const h = hp(L, CROP);
  const r = hpRect(L, CROP);
  const ln = lanes(r.h, r.w, r.hh);
  const row = {
    arm: arm.id, kind: arm.kind, what: arm.what, applied,
    rho_vs_baseline: corr(baseH, h), band_energy: energy(h),
    band_energy_pct_of_baseline: +(100 * energy(h) / out.baseline_band_energy).toFixed(1),
    ...ln,
    lane_power_pct_of_baseline: +(100 * ln.lane_power / Math.max(1e-6, out.baseline_lane.lane_power)).toFixed(1),
    whole_frame_changed_pct: changed(base, buf),
    vacuous: !!(arm.edits && !applied.edits_applied),
  };
  out.arms.push(row);
  console.log(`  ${arm.id.padEnd(28)} lane_power ${String(row.lane_power).padStart(8)} (${String(row.lane_power_pct_of_baseline).padStart(5)}%)  aniso ${String(row.lane_aniso).padStart(6)} @${String(row.lane_angle).padStart(4)}deg   energy ${String(row.band_energy).padStart(7)}  rho ${String(row.rho_vs_baseline).padStart(6)}  ${row.vacuous ? 'VACUOUS — substitution matched nothing' : JSON.stringify(applied)}`);
  if (arm.edits) await restoreEdits(); else if (arm.undo) await arm.undo();
  await step(4);
}

/* --- verdicts, two-sided --------------------------------------------------------------------- */
const byId = Object.fromEntries(out.arms.map((a) => [a.arm, a]));
const floor = byId['nothing-restore-control'];
const pos = byId['water-hidden'];
out.floor_rho = floor ? floor.rho_vs_baseline : null;
out.checks = {};
out.checks['INSTRUMENT-CAN-SEE-LANES'] = (pos && floor && pos.rho_vs_baseline < floor.rho_vs_baseline - 0.2)
  ? `PASS — water-hidden rho ${pos.rho_vs_baseline} against floor ${floor.rho_vs_baseline}`
  : `FAIL — water-hidden rho ${pos && pos.rho_vs_baseline} did not collapse against floor ${floor && floor.rho_vs_baseline}; every other row in this run is void`;
out.checks['NULL-CONTROL-MUST-NOT-FIX'] = (() => {
  const n = byId['null-recolour-and-amplitude'];
  if (!n) return 'FAIL — null control did not run';
  if (n.vacuous) return 'FAIL — null control substitution matched nothing (vacuous arm)';
  if (n.whole_frame_changed_pct < 1) return `FAIL — null control changed only ${n.whole_frame_changed_pct}% of the frame; it is not a visible change to the water and cannot be a control`;
  return (floor && n.rho_vs_baseline > floor.rho_vs_baseline - 0.2)
    ? `PASS — the null control visibly changed the water (${n.whole_frame_changed_pct}% of the frame) and left the lanes standing (rho ${n.rho_vs_baseline} against floor ${floor.rho_vs_baseline})`
    : `FAIL — the null control ALSO removed the lanes (rho ${n.rho_vs_baseline}); it is not a wrong answer and cannot discriminate`;
})();
// Two-sided classification of every arm against the floor, on the DIRECTIONAL metric. Two-sided
// because HAZARDS.md 0b: a guard that can only see the direction its author expected fails on half
// the number line, and an arm that makes the banding WORSE is as much a finding as one that fixes it.
const F = floor ? floor.lane_power : out.baseline_lane.lane_power;
const FA = floor ? floor.lane_aniso : out.baseline_lane.lane_aniso;
out.arms.forEach((a) => {
  if (a.vacuous) { a.verdict = 'VACUOUS'; return; }
  const d = 100 * (a.lane_power - F) / Math.max(1e-6, F);
  const da = 100 * (a.lane_aniso - FA) / Math.max(1e-6, FA);
  a.lane_power_vs_floor_pct = +d.toFixed(1);
  a.lane_aniso_vs_floor_pct = +da.toFixed(1);
  a.energy_vs_floor_pct = floor ? +(100 * (a.band_energy - floor.band_energy) / floor.band_energy).toFixed(1) : null;
  a.verdict = (d < -35 && da < -20) ? 'REMOVES THE LANES'
    : (d < -35 ? 'weaker banding, same anisotropy — dimmed the crop rather than unbanding it'
      : (d > 35 ? 'MAKES THE BANDING WORSE' : 'no effect on the lanes'));
});
out.checks['LANE-METRIC-CAN-FAIL'] = (pos && floor && pos.lane_power < floor.lane_power * 0.65)
  ? `PASS — the lane metric drops ${Math.round(100 - 100 * pos.lane_power / floor.lane_power)}% when the water is hidden, so it can go red`
  : `FAIL — hiding the water did not drop lane_power (${pos && pos.lane_power} against floor ${floor && floor.lane_power}); this metric cannot see the lanes and no row below is readable`;
out.pageErrors = g.errors.slice(0, 20);
fs.writeFileSync(path.join(OUT, 'lane-terms.json'), JSON.stringify(out, null, 2));
console.log('');
for (const [k, v] of Object.entries(out.checks)) console.log(`${k}: ${v}`);
console.log('');
for (const a of out.arms) console.log(`  ${a.arm.padEnd(28)} ${String(a.verdict).padEnd(58)} lane_power ${a.lane_power_vs_floor_pct > 0 ? '+' : ''}${a.lane_power_vs_floor_pct}%, aniso ${a.lane_aniso_vs_floor_pct > 0 ? '+' : ''}${a.lane_aniso_vs_floor_pct}% vs floor`);
console.log(`\nwrote ${path.join(OUT, 'lane-terms.json')}`);
await g.close();
process.exit(String(out.checks['INSTRUMENT-CAN-SEE-LANES']).startsWith('PASS') ? 0 : 3);
