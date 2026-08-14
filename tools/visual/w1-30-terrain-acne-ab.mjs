#!/usr/bin/env node
/**
 * w1-30-terrain-acne-ab.mjs — did turning the terrain into a shadow caster put STRIPES on the
 * ground, or were they always there?
 *
 * WHY IT EXISTS. `ground.castShadow = true` is the change most likely to pay for itself in acne:
 * a large, gently sloped, low-tessellation surface self-shadowing against a 4096 map fitted to
 * 150 m is the textbook case. The Deep Marshes vista on hardware showed regular parallel bands
 * across the ground and the honest first reading was "that is acne and it is mine". It measures
 * 7.57% row-to-row luminance jumps in its lower half against 0.90% in the Salt Hills, so the
 * bands are real and they are localised.
 *
 * THE ARMS, and B is the one that can falsify the accusation:
 *   A  as shipped — `ground` and `ground-skin` cast.
 *   B  the same frame with those flags put back the way they were before this piece, IN THE PAGE.
 *      If the bands are this change's acne they disappear. If they survive, they belong to
 *      something that was already casting (the province is full of posts, boardwalk piles and
 *      landmark trunks that have always cast) and the accusation is withdrawn.
 *   C  `ground` casts, `ground-skin` does not — which of the two owns any difference B finds.
 *
 * RESULT ON 2026-08-14: the bands are IDENTICAL in A and B. They are not this change's acne. The
 * whole difference between A and B at that camera is 1.394% of pixels — the terrain's real,
 * modest contribution — and none of it is striped.
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
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/shadow-casters/acne');
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
fs.mkdirSync(OUT, { recursive: true });

const g = await launchGame({ entry: 'game/index.html', width: CW, height: CH, hardwareGpu: args.hardware === true });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  const R = window.__ENGINE.renderer;
  if (R.renderer && R.renderer.setPixelRatio) R.renderer.setPixelRatio(1);
  R.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', DECK.capture.seed);

const s = DECK.setups.find((x) => x.id === SITE);
if (!s) throw new Error(`no Deck setup '${SITE}'`);
await g.h('teleport', s.place.x, s.place.z);
await g.h('stepFrames', 30);
const snap = await g.h('snapshot');
const [px, py, pz] = snap.player.pos;
const yaw = (s.camera.yaw_deg || 0) * Math.PI / 180, pitch = (s.camera.pitch_deg || 0) * Math.PI / 180;
const h = s.camera.height_m || 0, fwd = 60;
await g.h('camera', { pos: [px, py + h, pz],
  look: [px + Math.sin(yaw) * fwd, py + h + Math.tan(pitch) * fwd, pz + Math.cos(yaw) * fwd] });
await g.h('setWeather', 'clear'); await g.h('setTimeOfDay', Number(args.time || 13));
await g.h('stepFrames', 12);

const shot = async (f) => {
  const d = await g.h('screenshot');
  fs.writeFileSync(path.join(OUT, f), Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64'));
};
await shot('dm-A-as-shipped.png');

const n = await g.page.evaluate(() => {
  let k = 0; window.__A = [];
  window.__ENGINE.renderer.scene.traverse((o) => {
    if ((o.name === 'ground' || o.name === 'ground-skin') && o.castShadow) { window.__A.push(o); o.castShadow = false; k++; }
  });
  return k;
});
console.log(`arm B: terrain casting turned back off on ${n} mesh(es)`);
await g.h('stepFrames', 6);
await shot('dm-B-terrain-not-casting.png');

await g.page.evaluate(() => { for (const o of window.__A) if (o.name === 'ground') o.castShadow = true; });
await g.h('stepFrames', 6);
await shot('dm-C-ground-casts-skin-does-not.png');
console.log('done');
await g.close();
