#!/usr/bin/env node
/**
 * vt-playmode.mjs — the same see-through measurement, but in PLAY mode.
 *
 * Everything else in this sweep runs under `?harness=1`, and `render/renderer.js:62-67`
 * constructs the WebGL context differently there (`preserveDrawingBuffer` is on only when
 * automated). A person plays the other build. If the player body were translucent for a person
 * and solid for the harness, every harness measurement would be certifying the wrong build —
 * which is the whole failure mode this pass exists to test. So: same orbit, same three-way
 * material swap, but `?mode=play`, the rAF loop driving the sim, and `page.screenshot()` of the
 * real canvas rather than the harness's preserved copy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i+1] && !process.argv[i+1].startsWith('--')) ? process.argv[++i] : true;
}
const OUT = path.resolve(args.out || 'docs/shots/2026-08-14-visual-truth/playmode');
fs.mkdirSync(OUT, { recursive: true });
const STEPS = Number(args.steps || 8);

// `mode=play` overrides the webdriver-implied harness mode (main.js reads ?mode first).
const g = await launchGame({ entry: 'game/index.html?mode=play', width: 960, height: 540 });
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 90000 });
await g.h('ready');
const mode = await g.page.evaluate(() => ({
  automated: globalThis.__ES_AUTOMATED,
  preserveDrawingBuffer: window.__ENGINE.renderer.preserveDrawingBuffer,
  engineMode: window.__ENGINE.mode,
}));
console.log('mode check:', JSON.stringify(mode));
if (mode.automated === true) console.log('WARNING: still automated — the play-mode contrast is not being tested');

// let the real rAF loop run
await g.page.waitForTimeout(2500);

await g.page.evaluate(async () => {
  const THREE = await import('/game/vendor/three/three.module.js');
  window.__T = THREE;
  const sc = window.__ENGINE.renderer.scene;
  let root = null; sc.traverse(o => { if (o.name === 'player' && !root) root = o; });
  window.__playerRoot = root;
  const inPlayer = new Set(); root.traverse(o => inPlayer.add(o));
  sc.traverse(o => { if ((o.isMesh || o.isSkinnedMesh || o.isInstancedMesh) && !inPlayer.has(o)) o.visible = false; });
  if (sc.fog) { Object.defineProperty(sc.fog, 'density', { get: () => 0, set: () => {}, configurable: true }); }
  root.traverse(o => { if (/contact-shadow|action-silhouette/.test(o.name || '')) o.visible = false; });
});
async function setMode(m) {
  await g.page.evaluate((mm) => {
    const THREE = window.__T, root = window.__playerRoot;
    if (!window.__origMats) {
      window.__origMats = [];
      root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) window.__origMats.push([o, o.material]); });
      window.__solidMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
      window.__goneMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false });
    }
    for (const [o, orig] of window.__origMats) o.material = mm === 'ship' ? orig : (mm === 'solid' ? window.__solidMat : window.__goneMat);
  }, m);
  await g.page.waitForTimeout(180); // let rAF draw at least a few frames in the new state
}
const grab = async (f) => { const b = await g.page.screenshot({ path: path.join(OUT, f) }); return PNG.sync.read(b); };
function diffMask(png, ref, thr = 10) {
  const m = new Uint8Array(png.width * png.height); const d = png.data, r = ref.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) m[p] = (Math.abs(d[i]-r[i]) + Math.abs(d[i+1]-r[i+1]) + Math.abs(d[i+2]-r[i+2])) > thr ? 1 : 0;
  return m;
}

const snap = await g.h('snapshot');
const [px, py, pz] = snap.player.pos;
const rows = [];
for (let i = 0; i < STEPS; i++) {
  const a = (i / STEPS) * Math.PI * 2, R = Number(args.radius || 2.6);
  await g.h('camera', { pos: [px + Math.sin(a) * R, py + 1.15, pz + Math.cos(a) * R], look: [px, py + 0.95, pz], fov: 45 });
  const deg = Math.round(i / STEPS * 360), tag = String(deg).padStart(3, '0');
  await setMode('ship');  const ship = await grab(`playmode-${tag}-shipping.png`);
  await setMode('solid'); const solid = await grab(`playmode-${tag}-solid.png`);
  await setMode('gone');  const gone = await grab(`playmode-${tag}-gone.png`);
  await setMode('ship');
  const A = diffMask(ship, gone), B = diffMask(solid, gone);
  const w = ship.width, h = ship.height;
  const inHud = (x, y) => (x < w * 0.36 && y < h * 0.20) || (x > w * 0.78 && y < h * 0.18) || (x > w * 0.78 && y > h * 0.72);
  let body = 0, holes = 0;
  const overlay = new PNG({ width: w, height: h }); ship.data.copy(overlay.data);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x; if (inHud(x, y) || !B[p]) continue;
    body++;
    if (!A[p]) { holes++; const o = p * 4; overlay.data[o] = 255; overlay.data[o+1] = 0; overlay.data[o+2] = 0; }
  }
  fs.writeFileSync(path.join(OUT, `playmode-${tag}-holes.png`), PNG.sync.write(overlay));
  const frac = body ? holes / body : 0;
  rows.push({ deg, body_px: body, seethrough_px: holes, seethrough_frac: +frac.toFixed(4) });
  console.log(`${String(deg).padStart(3)}deg  body=${String(body).padStart(7)}px  see-through=${String(holes).padStart(6)}px  ${(frac*100).toFixed(1)}%`);
}
fs.writeFileSync(path.join(OUT, 'playmode-seethrough.json'), JSON.stringify({ mode, rows,
  mean_frac: +(rows.reduce((s, r) => s + r.seethrough_frac, 0) / rows.length).toFixed(4) }, null, 2));
console.log('PLAY MODE mean see-through:', (rows.reduce((s,r)=>s+r.seethrough_frac,0)/rows.length*100).toFixed(1) + '%');
await g.close();
