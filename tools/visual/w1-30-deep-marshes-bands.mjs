#!/usr/bin/env node
/**
 * w1-30-deep-marshes-bands.mjs — the parallel bands on the Deep Marshes ground: who owns them?
 *
 * WRITTEN BY THE CRITIC OF W1-30-SHADOW-CASTERS. That piece found regular parallel bands across
 * the Deep Marshes ground in its hardware capture, suspected its own terrain caster flags, ran an
 * A/B, and correctly falsified the accusation: with `ground.castShadow` and `ground-skin.castShadow`
 * put back to false the bands are identical. It then attributed them to *"something that was
 * already casting (the province is full of posts, piles and landmark trunks that always have)"* —
 * and that attribution was never tested. "Not mine" is half an answer; the bands are in a shipped
 * frame and something owns them.
 *
 * THE OFFLINE MEASUREMENT THAT MADE THIS TOOL NECESSARY. High-passed and cross-correlated over a
 * band-rich crop of the committed hardware stills, the pattern is 0.844 self-similar between 08:00
 * and 13:00 and 0.67-0.69 against 19:30, against 0.046 for the same crop of a different region
 * (the negative control). A shadow pattern cannot be that self-similar across a whole day — the
 * individual tree shadows in the same frames visibly swing. So the bands are locked to the world,
 * not to the sun, and the first thing to test is whether they are shadows at all.
 *
 * THE ARMS, cheapest and most decisive first. Each one hides or disables ONE candidate and the
 * frame is correlated against the untouched baseline over the same crop; the arm whose correlation
 * COLLAPSES owns the bands.
 *
 *   shadows-off     `setFeature('shadows', false)`. If the bands survive this they are not shadows
 *                   and no caster owns them, whatever the caster A/B said.
 *   water-hidden    the water surface. `render/water.js`'s own comment records that its first wave
 *                   field produced "axis-aligned 20 m light/dark lanes" — which is what these look
 *                   like — and the Deep Marshes is a flooded region.
 *   skin-hidden     `ground-skin`, the lifted berm/bank/spoil layer.
 *   cover-hidden    `cover:*`, the ground-cover shells.
 *   ground-hidden   `ground`, the tile terrain itself — the backstop arm.
 *
 * THE CONTROL THAT MUST NOT MOVE. `nothing` re-captures the baseline after the arms have been
 * applied and restored. If it does not come back to ~1.0 against the first baseline, the restore
 * is broken and no arm above means anything.
 *
 * Usage:
 *   node tools/visual/w1-30-deep-marshes-bands.mjs
 *   node tools/visual/w1-30-deep-marshes-bands.mjs --site vista-deep-marshes --time 13
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
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/deep-marshes-bands');
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
// The band-rich crop, in the 960x540 frame the committed hardware stills use. Chosen off those
// stills before any arm was run, so it is not fitted to a result.
const CROP = String(args.crop || '560,900,300,470').split(',').map(Number);

const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));

function lum(buf) {
  const p = PNG.sync.read(buf);
  const y = new Float32Array(p.width * p.height);
  for (let i = 0, j = 0; i < p.data.length; i += 4, j++) {
    y[j] = 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2];
  }
  return { y, w: p.width, h: p.height };
}
/** Vertical high-pass: keeps band structure, throws away the overall brightness an arm may change. */
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
/** Band energy: mean |high-pass| over the crop. An arm that deletes the bands drops this too. */
function energy(h) { let s = 0; for (const v of h) s += Math.abs(v); return +(s / h.length).toFixed(3); }

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
const height = c.height_m || 0, fwd = 60;
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

/** Hide every mesh whose name matches one of the prefixes; returns how many it actually hid. */
const hide = (prefixes) => g.page.evaluate(({ prefixes }) => {
  const R = window.__ENGINE.renderer;
  window.__BANDS = [];
  let hidden = 0;
  R.scene.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh) || !o.visible) return;
    const n = o.name || '';
    if (!prefixes.some((p) => n === p || n.startsWith(p))) return;
    window.__BANDS.push(o); o.visible = false; hidden++;
  });
  return hidden;
}, { prefixes });
const unhide = () => g.page.evaluate(() => { for (const o of (window.__BANDS || [])) o.visible = true; window.__BANDS = []; });
const setFeature = (n, o) => g.page.evaluate(({ n, o }) => window.__ENGINE.renderer.sky.setFeature(n, o), { n, o });

const base = await shot('00-baseline');
const baseH = hp(lum(base), CROP);
const out = { site: SITE, time: TIME, crop: CROP, canvas: [CW, CH], seed: SEED,
  baseline_band_energy: energy(baseH), arms: [], pageErrors: [] };
console.log(`baseline band energy ${out.baseline_band_energy}`);

const ARMS = [
  { id: 'shadows-off', run: async () => { await setFeature('shadows', false); return { feature: 'shadows=false' }; },
    undo: async () => setFeature('shadows', true) },
  { id: 'water-hidden', run: async () => ({ hidden: await hide(['water', 'province-water', 'water-']) }), undo: unhide },
  { id: 'skin-hidden', run: async () => ({ hidden: await hide(['ground-skin']) }), undo: unhide },
  { id: 'cover-hidden', run: async () => ({ hidden: await hide(['cover:']) }), undo: unhide },
  { id: 'ground-hidden', run: async () => ({ hidden: await hide(['ground']) }), undo: unhide },
  { id: 'nothing-restore-control', run: async () => ({}), undo: async () => {} },
];

for (const arm of ARMS) {
  const applied = await arm.run();
  await step(4);
  const buf = await shot(arm.id);
  const h = hp(lum(buf), CROP);
  const row = { arm: arm.id, applied, rho_vs_baseline: corr(baseH, h), band_energy: energy(h) };
  out.arms.push(row);
  console.log(`  ${arm.id.padEnd(24)} rho ${String(row.rho_vs_baseline).padStart(6)}  band energy ${String(row.band_energy).padStart(7)}  ${JSON.stringify(applied)}`);
  await arm.undo();
  await step(4);
}

// What the scene actually calls its meshes, so an arm that hid nothing is diagnosable.
out.mesh_names = await g.page.evaluate(() => {
  const R = window.__ENGINE.renderer; const seen = {};
  R.scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { const k = (o.name || o.type).replace(/:.*$/, ''); seen[k] = (seen[k] || 0) + 1; } });
  return Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 25);
});
out.pageErrors = g.errors.slice(0, 20);
fs.writeFileSync(path.join(OUT, 'bands.json'), JSON.stringify(out, null, 2));
console.log(`\nmesh name census: ${JSON.stringify(out.mesh_names)}`);
console.log(`wrote ${path.join(OUT, 'bands.json')}`);
await g.close();
