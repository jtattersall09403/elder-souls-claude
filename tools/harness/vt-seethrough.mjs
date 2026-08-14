#!/usr/bin/env node
/**
 * vt-seethrough.mjs — measure, per camera angle, how much of the player's own body
 * silhouette you can see straight THROUGH.
 *
 * Method (falsifiable, and it does not depend on anyone's eye):
 *   For each of N angles on a full orbit, render the player alone against a flat backdrop
 *   twice.
 *     A. the shipping materials.                      mask A = "what the player sees"
 *     B. every player material swapped for an opaque  mask B = "the body's true outline"
 *        flat colour with side = DoubleSide.
 *   Holes = B \ A: pixels inside the body's outline where the backdrop comes through.
 *   holes/|B| is the see-through fraction at that angle. A solid character scores ~0
 *   at every angle.
 *
 * A red overlay per angle is written so the result can be looked at, not just read.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchForCapture, resolveGpuMode } from '../visual/lib/gpu-launch.mjs';
import { manifestRendererFields, rendererBanner } from '../visual/lib/renderer-class.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i+1] && !process.argv[i+1].startsWith('--')) ? process.argv[++i] : true;
}
const OUT = path.resolve(args.out || 'docs/shots/2026-08-14-visual-truth/seethrough');
fs.mkdirSync(OUT, { recursive: true });
const STEPS = Number(args.steps || 24);
const TAG = String(args.tag || 'player');

// Which renderer drew these pixels is not a matter of which flag was passed: it is read back
// from the page and stamped into renderer.json beside the frames, so a reader of this directory
// never has to take the evidence class on trust. VT_HARDWARE_GPU=1 still works; --gpu hardware is
// the explicit form; the default is this box on SwiftShader, which is cheap and always available.
const GPU_MODE = resolveGpuMode(args);
const { g, attestation } = await launchForCapture({
  mode: GPU_MODE,
  requireHardware: args['require-hardware'] === true,
  entry: 'game/index.html', width: 900, height: 900,
});
console.log(rendererBanner(attestation));
fs.writeFileSync(path.join(OUT, 'renderer.json'), JSON.stringify({
  schema: 'elder-souls/capture-renderer@1', at: new Date().toISOString(),
  tool: 'tools/harness/vt-seethrough.mjs', gpu_mode_requested: GPU_MODE,
  gpu_backend: attestation.backend || null,
  ...manifestRendererFields(attestation),
}, null, 2) + '\n');
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 90000 });
await g.h('ready');
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
await setCanvas(g, CW, CH);

if (args.at) { const [x,z] = String(args.at).split(',').map(Number); await g.h('teleport', x, z); }
await g.h('stepFrames', Number(args.settle || 40));

// Isolate the player against a flat backdrop: no world, no fog, no sky.
await g.page.evaluate(async () => {
  const THREE = await import('/game/vendor/three/three.module.js');
  window.__T = THREE;
  const sc = window.__ENGINE.renderer.scene;
  let root = null; sc.traverse(o => { if (o.name === 'player' && !root) root = o; });
  window.__playerRoot = root;
  const inPlayer = new Set(); root.traverse(o => inPlayer.add(o));
  window.__hidden = [];
  sc.traverse(o => {
    if (!(o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o.isPoints || o.isLine)) return;
    if (inPlayer.has(o)) return;
    if (o.visible) { window.__hidden.push(o); o.visible = false; }
  });
  // Do NOT null scene.fog — Sky.apply() writes into it every frame and would throw.
  // Neutralise it instead and PIN it, because Sky.apply() recomputes density and colour
  // on every render. A plain assignment would be overwritten before the screenshot.
  if (sc.fog) {
    const f = sc.fog;
    let d = 0;
    Object.defineProperty(f, 'density', { get: () => 0, set: () => { d = 0; }, configurable: true });
    const col = f.color;
    col.setHex(0x00ff00);
    Object.defineProperty(f, 'color', { get: () => { col.setHex(0x00ff00); return col; }, set: () => {}, configurable: true });
  }
  const bg = new THREE.Color(0x00ff00);
  Object.defineProperty(sc, 'background', { get: () => bg, set: () => {}, configurable: true });
  // The contact-shadow disc and the action ring are ground decals, not body. Exclude both
  // from the body outline so they cannot flatter or damage the number.
  window.__decals = [];
  root.traverse(o => { if (/contact-shadow|action-silhouette/.test(o.name || '')) { window.__decals.push([o, o.visible]); o.visible = false; } });
});

// `actor.js:988` reasserts `mesh.visible` on the body every frame, so hiding the player does
// not survive to the next render. Material swaps DO survive — nothing per-frame reassigns
// `mesh.material` — so all three states here are material swaps.
//   'ship'  original materials
//   'solid' opaque flat colour, DoubleSide  -> the body's true outline
//   'gone'  colorWrite off, depth off        -> the player-absent reference
async function setMode(mode) {
  await g.page.evaluate((m) => {
    const THREE = window.__T, root = window.__playerRoot;
    if (!window.__origMats) {
      window.__origMats = [];
      root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) window.__origMats.push([o, o.material]); });
      window.__solidMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
      window.__goneMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false });
    }
    for (const [o, orig] of window.__origMats) {
      o.material = m === 'ship' ? orig : (m === 'solid' ? window.__solidMat : window.__goneMat);
    }
  }, mode);
}

function decode(dataUrl) {
  return PNG.sync.read(Buffer.from(String(dataUrl).replace(/^data:image\/png;base64,/, ''), 'base64'));
}
/** Differs-from-reference mask. No colour key: a pixel is "covered" if it differs from the
 *  same pixel in the player-removed reference frame by more than a small threshold. */
function diffMask(png, ref, thr = 10) {
  const { width: w, height: h, data } = png; const rd = ref.data;
  const m = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const d = Math.abs(data[i]-rd[i]) + Math.abs(data[i+1]-rd[i+1]) + Math.abs(data[i+2]-rd[i+2]);
    m[p] = d > thr ? 1 : 0;
  }
  return m;
}

const snap = await g.h('snapshot');
const [px, py, pz] = snap.player.pos;
const rows = [];
for (let i = 0; i < STEPS; i++) {
  const a = (i / STEPS) * Math.PI * 2;
  const R = Number(args.radius || 2.6);
  await g.h('camera', { pos: [px + Math.sin(a) * R, py + 1.15, pz + Math.cos(a) * R], look: [px, py + 0.95, pz], fov: 45 });

  await setMode('ship');
  const shipPng = decode(await g.h('screenshot'));
  await setMode('solid');
  const solidPng = decode(await g.h('screenshot'));
  await setMode('gone');
  const refPng = decode(await g.h('screenshot'));
  await setMode('ship');

  const A = diffMask(shipPng, refPng), B = diffMask(solidPng, refPng);
  const { width: w, height: h } = shipPng;
  let body = 0, holes = 0;
  const overlay = new PNG({ width: w, height: h });
  shipPng.data.copy(overlay.data);
  // Ignore the HUD strip (top-left bars, bottom-right compass) — they are drawn over
  // everything and belong to neither mask.
  const inHud = (x, y) => (x < 470 && y < 140) || (x > w - 260 && y > h - 220);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    if (inHud(x, y)) continue;
    if (!B[p]) continue;
    body++;
    if (!A[p]) { holes++; const o = p * 4; overlay.data[o] = 255; overlay.data[o+1] = 0; overlay.data[o+2] = 0; overlay.data[o+3] = 255; }
  }
  const deg = Math.round(i / STEPS * 360);
  fs.writeFileSync(path.join(OUT, `${TAG}-${String(deg).padStart(3,'0')}-shipping.png`), PNG.sync.write(shipPng));
  fs.writeFileSync(path.join(OUT, `${TAG}-${String(deg).padStart(3,'0')}-holes.png`), PNG.sync.write(overlay));
  const frac = body ? holes / body : 0;
  rows.push({ deg, body_px: body, seethrough_px: holes, seethrough_frac: +frac.toFixed(4) });
  console.log(`${String(deg).padStart(3)}deg  body=${String(body).padStart(6)}px  see-through=${String(holes).padStart(6)}px  ${(frac*100).toFixed(1)}%`);
}
fs.writeFileSync(path.join(OUT, `${TAG}-seethrough.json`), JSON.stringify({
  method: 'B\\A over a full orbit; A = shipping materials, B = same meshes forced opaque DoubleSide',
  radius_m: Number(args.radius || 2.6), steps: STEPS, rows,
  worst: rows.reduce((m, r) => r.seethrough_frac > m.seethrough_frac ? r : m, rows[0]),
  mean_frac: +(rows.reduce((s, r) => s + r.seethrough_frac, 0) / rows.length).toFixed(4),
}, null, 2));
console.log('mean see-through fraction:', (rows.reduce((s,r)=>s+r.seethrough_frac,0)/rows.length*100).toFixed(1) + '%');
await g.close();

// Shrink the capture backing store. In harness mode main.js never resizes the canvas, so it
// stays at the 1920x1080 in the HTML and every screenshot() pays a 2 Mpx readPixels. For a
// defect sweep 960x540 is plenty and it is ~4x cheaper, which is the difference between a
// sequence and a still.
async function setCanvas(g, w, h) {
  await g.page.evaluate(({ w, h }) => {
    const c = document.getElementById('view');
    c.width = w; c.height = h;
    const R = window.__ENGINE.renderer;
    if (R.setSize) R.setSize(w, h);
    else if (R.three && R.three.setSize) { R.three.setSize(w, h, false); if (R.camera) { R.camera.aspect = w / h; R.camera.updateProjectionMatrix(); } }
  }, { w, h });
}
