#!/usr/bin/env node
/**
 * w1-30-heightfalloff-arm.mjs — does the shipped frame actually READ
 * `regions.json.fog.height_falloff_m`, or only a copy of it?
 *
 * WHY THIS EXISTS AND WHY THE OBVIOUS CONTROL IS WORTHLESS. `sky.js` carries
 * `REGION_HEIGHT_FALLOFF_M`, a thirteen-row table keyed on each region's fog colour, whose values
 * are byte-identical to the thirteen `fog.height_falloff_m` in `game/data/world/regions.json`.
 * So "add the field to `renderer.js`'s `regionFog` literal" changes no pixel today and a
 * before/after screenshot pair proves NOTHING — both arms agree, wrongly, that the table and the
 * JSON are the same thing (HAZARDS §0, the fifth control failure).
 *
 * THE CONTROL THAT CAN FAIL. Perturb the region record the renderer is actually reading — set one
 * region's `height_falloff_m` to a different number in the live page — and re-render:
 *
 *   BEFORE the wiring: the frame does not move. `sky.js` falls through to the colour-keyed table,
 *                      the JSON is decorative, and that is the defect.
 *   AFTER  the wiring: the frame moves. The declared field is what the air is made of.
 *
 * That is the plausible-wrong-answer control rather than the trivial one: the trivial control is
 * `setFeature('heightFog', false)`, which proves the MODEL is live and says nothing about where
 * its parameter came from.
 *
 * BOTH ARMS IN ONE RUN. `--deleteFix` reproduces the pre-fix build exactly without editing a file
 * or cloning the repo: it wraps `sky.apply()` and deletes `heightFalloffM` off the object
 * `renderer.js` just built, which is byte-for-byte the state before the one-line change, because
 * the change is that property and nothing else. Rule 3 — a fix is not a fix until it has been
 * deleted and the old number has come back — executed against the shipping code path rather than
 * against a copy of it.
 *
 * Usage: node tools/visual/w1-30-heightfalloff-arm.mjs --tag after --sites vista-blackwood
 *        node tools/visual/w1-30-heightfalloff-arm.mjs --tag delete-the-fix --deleteFix
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
const TAG = String(args.tag || 'before');
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/heightfalloff/${TAG}`);
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '1280x720').split('x').map(Number);
const SITES = String(args.sites || 'vista-blackwood,vista-deep-marshes,spawn').split(',');
const FACTOR = Number(args.factor || 4);

const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
const g = await launchGame({ entry: 'game/index.html', width: CW, height: CH, hardwareGpu: args.hardware === true });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', Number(args.seed || DECK.capture.seed));

async function shot(file) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  if (file) fs.writeFileSync(path.join(OUT, 'frames', file), buf);
  return buf;
}
function diff(a, b) {
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  let n = 0, sum = 0; const tot = A.data.length / 4;
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
    if (d > 6) n++; sum += d;
  }
  return { pct: +(n / tot * 100).toFixed(3), mean: +(sum / tot).toFixed(3) };
}
const step = (n) => g.h('stepFrames', n);

async function goTo(site) {
  if (site === 'spawn') { await step(30); return null; }
  const s = DECK.setups.find((x) => x.id === site);
  if (!s) return `no Deck setup '${site}'`;
  await g.h('teleport', s.place.x, s.place.z);
  await step(30);
  const snap = await g.h('snapshot');
  const [px, py, pz] = snap.player.pos;
  const c = s.camera;
  const yaw = (c.yaw_deg || 0) * Math.PI / 180, pitch = (c.pitch_deg || 0) * Math.PI / 180;
  const height = c.height_m || 0, fwd = 60;
  await g.h('camera', { pos: [px, py + height, pz],
    look: [px + Math.sin(yaw) * fwd, py + height + Math.tan(pitch) * fwd, pz + Math.cos(yaw) * fwd] });
  await step(2);
  return null;
}

const out = { tag: TAG, factor: FACTOR, canvas: [CW, CH], deleteFix: args.deleteFix === true,
  rows: [], chunkOwner: null, pageErrors: [] };
if (out.deleteFix) {
  const ok = await g.page.evaluate(() => {
    const sky = window.__ENGINE.renderer.sky;
    const real = sky.apply.bind(sky);
    sky.apply = (h, w, f, regionFog, ...rest) => {
      if (regionFog) delete regionFog.heightFalloffM;
      return real(h, w, f, regionFog, ...rest);
    };
    return true;
  });
  console.log(`DELETE-THE-FIX arm installed (${ok}): sky.apply() now receives the pre-fix regionFog.`);
}
out.chunkOwner = await g.page.evaluate(async () => {
  const THREE = await import('/game/vendor/three/three.module.js');
  const f = THREE.ShaderChunk.fog_fragment;
  return /esAerialScale/.test(f) ? 'world/aerial.js' : (/esSigma0/.test(f) ? 'render/sky.js' : 'three stock');
});
console.log(`the four fog ShaderChunks are currently owned by: ${out.chunkOwner}`);

for (const site of SITES) {
  const err = await goTo(site);
  if (err) { out.rows.push({ site, error: err }); continue; }
  await g.h('setWeather', 'clear'); await g.h('setTimeOfDay', 13); await step(10);
  const base = await shot(`${site}-base.png`);
  const state0 = await g.page.evaluate(() => {
    const sc = window.__ENGINE.renderer.scene, P = window.__ENGINE.renderer.province;
    return { sigma0: sc.fog.sigma0, H: sc.fog.heightFalloff, aerialH: P ? P._aerialH : null };
  });

  // ---- the arm: change the DECLARED field on the live region record and re-render -------------
  const declared = await g.page.evaluate(({ FACTOR }) => {
    const R = window.__ENGINE.renderer;
    const cx = R.camera.position.x, cz = R.camera.position.z;
    const r = R.field.regionAt(Math.max(0, Math.min(R.field.sizeX - 1, cx)), Math.max(0, Math.min(R.field.sizeZ - 1, cz)));
    window.__HF = { r, old: r.fog.height_falloff_m };
    r.fog.height_falloff_m = r.fog.height_falloff_m * FACTOR;
    if (R.province) { R.province._aerialH = null; R.province._updateAerial(cx, cz); }
    return { region: r.id, from: window.__HF.old, to: r.fog.height_falloff_m };
  }, { FACTOR });
  await step(6);
  const perturbed = await shot(`${site}-falloff-x${FACTOR}.png`);
  const state1 = await g.page.evaluate(() => {
    const sc = window.__ENGINE.renderer.scene, P = window.__ENGINE.renderer.province;
    return { sigma0: sc.fog.sigma0, H: sc.fog.heightFalloff, aerialH: P ? P._aerialH : null };
  });
  await g.page.evaluate(() => {
    const R = window.__ENGINE.renderer;
    window.__HF.r.fog.height_falloff_m = window.__HF.old;
    if (R.province) { R.province._aerialH = null; R.province._updateAerial(R.camera.position.x, R.camera.position.z); }
  });
  await step(6);

  const row = { site, declared, moved_pct: diff(base, perturbed).pct, state_before: state0, state_after: state1 };
  out.rows.push(row);
  console.log(`  ${site.padEnd(22)} ${declared.region} H ${declared.from} -> ${declared.to}   frame moved ${row.moved_pct}%   scene.fog.heightFalloff ${state0.H} -> ${state1.H}   aerial ${state0.aerialH} -> ${state1.aerialH}`);
}

out.pageErrors = g.errors.slice(0, 20);
fs.writeFileSync(path.join(OUT, 'heightfalloff.json'), JSON.stringify(out, null, 2));
console.log(`\nwrote ${path.join(OUT, 'heightfalloff.json')}`);
await g.close();
