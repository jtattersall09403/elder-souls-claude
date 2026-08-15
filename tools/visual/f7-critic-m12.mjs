#!/usr/bin/env node
/**
 * f7-critic-m12.mjs — F7 CRITIC. RUN THE CORPUS'S OWN WATER INSTRUMENT ON BOTH ARMS.
 *
 * The builder measured F7 with a bespoke banding-rms of its own construction. The corpus already
 * owns an instrument for exactly the property F7 changed, and it was not run:
 *
 *   RI-VIS03 M12 `FresnelDelta = mean(Yp[grazing]) - mean(Yp[downward])`, band >= 0.05,
 *   FAIL < 0.02 -> "no Fresnel; uniform plane"; cited by RI-VIS04 §9 as one of the two
 *   conclusive tells for the blue-plane failure.
 *
 * That is the fix's own thesis stated as a measurement. The defect was that the distance term
 * gave DOWNWARD-viewed water the same reflection weight as GRAZING water; the fix drops the
 * downward weight (.610 -> .250) and leaves grazing untouched (.627 -> .627). So if the fix does
 * what it says, `FresnelDelta` must RISE, and it must rise at a water_edge shot rather than the
 * straight-down pose where the metric's own grazing/downward split does not exist.
 *
 * The WATER_MASK is produced the way M12 asks for it first — from the renderer, by hiding every
 * `water*` mesh and differencing — not hand-drawn, so it is reproducible and it is not the
 * critic's opinion about where the water is.
 *
 *   node tools/visual/f7-critic-m12.mjs --site vista-deep-marshes --out <dir>
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
const SITES = String(args.sites || args.site || 'vista-deep-marshes').split(',');
const TIME = Number(args.time || 13);
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/f7-critic/m12');
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
const V = await import(path.join(REPO, 'tools/metrics/lib/vis03.mjs'));

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

async function shot(name) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(OUT, 'frames', `${name}.png`), buf);
  return buf;
}
const hideWater = () => g.page.evaluate(() => {
  const R = window.__ENGINE.renderer; window.__F7_HID = []; let n = 0;
  R.scene.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.visible && /^water/.test(o.name || '')) { window.__F7_HID.push(o); o.visible = false; n++; } });
  return n;
});
const unhide = () => g.page.evaluate(() => { for (const o of (window.__F7_HID || [])) o.visible = true; window.__F7_HID = []; });
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
    m.customProgramCacheKey = () => `f7-critic-m12:${armId}`; m.needsUpdate = true;
  }
  return { materials: mats.size };
}, { armId, edits });
const editCount = () => g.page.evaluate(() => window.__F7_EDITS || 0);

const ARMS = [
  { id: 'fixed', edits: null, what: 'HEAD b0f3224e as shipped' },
  { id: 'prefix', what: 'the (1.0-esView) factor deleted — the pre-fix build',
    edits: [['smoothstep(10.0,52.0,length(vViewPosition))*.72*(1.0-esView)', 'smoothstep(10.0,52.0,length(vViewPosition))*.72']] },
];

const results = { tool: 'f7-critic-m12', generated: new Date().toISOString(), seed: SEED, canvas: [CW, CH], bands: V.M12_BANDS, sites: {} };

for (const SITE of SITES) {
  const s = DECK.setups.find((x) => x.id === SITE);
  if (!s) { console.error(`no Deck setup '${SITE}'`); continue; }
  await g.h('teleport', s.place.x, s.place.z);
  await step(40);
  await g.h('setWeather', 'clear');
  await g.h('setTimeOfDay', TIME);
  await step(10);
  const snap = await g.h('snapshot');
  const [px, py, pz] = snap.player.pos;
  // A `water_edge` shot: low over the water so the frame carries both a far (grazing) and a near
  // (downward) band of water, which is what M12's grazing/downward split needs to exist at all.
  const yaw = (Number(s.camera.yaw_deg ?? 90)) * Math.PI / 180;
  const dist = 26, pit = -11 * Math.PI / 180;
  await g.h('camera', {
    pos: [px - Math.sin(yaw) * Math.cos(pit) * dist, py + 1.5 + Math.sin(-pit) * dist, pz - Math.cos(yaw) * Math.cos(pit) * dist],
    look: [px, py + 1.2, pz],
  });
  await step(10);

  const siteOut = { deck_declared_region: s.region, player: [+px.toFixed(2), +py.toFixed(2), +pz.toFixed(2)], arms: {} };
  for (const arm of ARMS) {
    if (arm.edits) { await applyEdits(arm.id, arm.edits); await step(8); siteOut.arms[arm.id + '_edits'] = await editCount(); }
    const base = await shot(`${SITE}-${arm.id}-base`);
    const hidden = await hideWater(); await step(4);
    const nowat = await shot(`${SITE}-${arm.id}-water-hidden`);
    await unhide(); await step(4);
    // WATER_MASK from the renderer: pixels that changed when every water mesh was hidden.
    const A = PNG.sync.read(base), B = PNG.sync.read(nowat);
    const N = A.width * A.height, water = new Uint8Array(N);
    let wn = 0;
    for (let i = 0, p = 0; i < N; i++, p += 4) {
      const d = Math.abs(A.data[p] - B.data[p]) + Math.abs(A.data[p + 1] - B.data[p + 1]) + Math.abs(A.data[p + 2] - B.data[p + 2]);
      if (d > 6) { water[i] = 1; wn++; }
    }
    // A stationary sequence for TemporalVar (M12 needs >= 5 frames).
    const seq = [];
    for (let i = 0; i < 8; i++) { const b = await shot(`${SITE}-${arm.id}-seq-${i}`); seq.push(V.prepare(PNG.sync.read(b)).Yp); await step(4); }
    const pl = V.prepare(A);
    const m12 = V.M12(pl, water, { sequence: seq });
    const verdict = {};
    for (const [k, band] of Object.entries(V.M12_BANDS)) {
      const v = m12[k];
      verdict[k] = v === null || v === undefined ? 'UNMEASURABLE' : (band.min !== undefined ? (v >= band.min ? 'PASS' : 'FAIL') : 'n/a');
    }
    siteOut.arms[arm.id] = {
      what: arm.what, water_meshes_hidden: hidden, water_mask_px: wn, water_mask_pct: +(100 * wn / N).toFixed(2),
      m12: Object.fromEntries(Object.entries(m12).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(5) : v])),
      band_verdict: verdict,
    };
    process.stderr.write(`${SITE}/${arm.id}: FresnelDelta ${m12.FresnelDelta} ReflCorr ${m12.ReflCorr} ShoreDelta ${m12.ShoreDelta} NormalEnergy ${m12.NormalEnergy} TemporalVar ${m12.TemporalVar}\n`);
    fs.writeFileSync(path.join(OUT, 'm12.json'), JSON.stringify(results, null, 2));
  }
  const F = siteOut.arms.fixed?.m12 || {}, P = siteOut.arms.prefix?.m12 || {};
  siteOut.fix_effect = {
    FresnelDelta_prefix: P.FresnelDelta, FresnelDelta_fixed: F.FresnelDelta,
    FresnelDelta_delta: (F.FresnelDelta != null && P.FresnelDelta != null) ? +(F.FresnelDelta - P.FresnelDelta).toFixed(5) : null,
    reading: 'the fix lowers the downward reflection weight and leaves grazing alone, so FresnelDelta must RISE if the fix does what it claims',
  };
  results.sites[SITE] = siteOut;
  fs.writeFileSync(path.join(OUT, 'm12.json'), JSON.stringify(results, null, 2));
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(results.sites).map(([k, v]) => [k, { fix_effect: v.fix_effect, fixed: v.arms.fixed?.band_verdict, prefix: v.arms.prefix?.band_verdict }])), null, 2));
await g.close();
