#!/usr/bin/env node
/**
 * w1-30-shadow-casters.mjs — how much shadow is a region vista missing, whose flags are missing
 * it, and what does turning each set on cost per frame?
 *
 * WHY THIS TOOL AND NOT `w1-30b-probe.mjs`. W1-30B's probe already proved the defect: its
 * `worldCastersOn` arm flips EVERY non-casting mesh in the scene to cast+receive for one frame
 * and measured 18.3% of the Blackwood vista and 22.9% of the Deep Marshes vista moving. That is
 * the CEILING, not a proposal — it submits tens of thousands of distant instances into a 4096
 * atlas and nobody has priced it. This tool takes the same measurement apart by NAMED SUBSET, and
 * prices each subset in milliseconds per frame on the same box in the same run, so the fix that
 * lands can be the cheapest subset that buys most of the 18.3%.
 *
 * THE SUBSETS, and they are exactly the sites `province.js` flags:
 *   terrain     `ground` (1452, never set -> cast off), `ground-skin` (1041, cast off),
 *               `province-far` (580, receive off). A hill cannot shadow itself and the far mesh
 *               cannot take a shadow from anything.
 *   near        `near-canopy|under|rock:*` (1249) — the 70 m deficit-filler disc.
 *   scatter     `canopy|under|rock:*` (2368) — the tile scatter, the PRIMARY vegetation: the near
 *               disc only fills what MAX_INSTANCES could not, so on most ground this is the set
 *               that owns whether a tree has a shadow.
 *   cover       `cover:*` (902) — ground cover shells.
 *   geology     `geology:*` (811) — rock instances.
 *
 * THE NULL CONTROL IS THE PLAUSIBLE WRONG ANSWER, NOT THE TRIVIAL ONE. "No shadows at all" is the
 * trivial control and `setFeature('shadows', false)` already is it. The plausible wrong answer —
 * the one a hurried fix actually ships — is `wrongset`: turn the CASTERS on and leave the
 * RECEIVERS alone. Trees and hills then cast into a world where `province-far` still refuses to
 * receive and `ground` still does not cast, so a shadow exists near the camera, dies at the seam
 * where the tile ground ends, and nothing beyond it is shadowed by anything. It looks like a fix
 * in a thumbnail and is a tree floating above a shadow that stops.
 *
 * COST. Frame time is wall-clock over N `stepFrames(1)` calls from Node with the sim at rest and
 * the camera pinned, so every arm renders the same world and the only difference is what is in
 * the shadow atlas. On SwiftShader this OVERSTATES the GPU share and understates nothing, so a
 * subset that is cheap here is cheap on hardware; a subset that is expensive here needs hardware
 * before it is called expensive. That asymmetry is stated in the output.
 *
 * Usage:
 *   node tools/visual/w1-30-shadow-casters.mjs --sites vista-blackwood,vista-deep-marshes,spawn
 *   node tools/visual/w1-30-shadow-casters.mjs --tag after --arms shipped
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
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/shadow-casters/${TAG}`);
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '1920x1080').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
const HW = args.hardware === true || process.env.VT_HARDWARE_GPU === '1';
const TIME = Number(args.time || 13);
const PERF_FRAMES = Number(args.perfFrames || 40);
const SITES = String(args.sites || 'vista-blackwood,vista-deep-marshes,spawn').split(',');

// Which mesh names each named subset owns. Kept as source-of-truth strings so a rename in
// province.js shows up here as an empty subset rather than as a silent zero.
const SUBSETS = {
  terrain: { cast: ['ground', 'ground-skin'], receive: ['province-far'] },
  near: { cast: ['near-canopy:', 'near-under:', 'near-rock:'], receive: [] },
  scatter: { cast: ['canopy:', 'under:', 'rock:'], receive: [] },
  cover: { cast: ['cover:'], receive: [] },
  geology: { cast: ['geology:'], receive: [] },
};

const ARM_SETS = {
  base: [],
  terrain: ['terrain'],
  'terrain+near': ['terrain', 'near'],
  'terrain+near+scatter': ['terrain', 'near', 'scatter'],
  everything: ['terrain', 'near', 'scatter', 'cover', 'geology'],
};

const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));

const g = await launchGame({ entry: 'game/index.html', width: CW, height: CH, hardwareGpu: HW });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', SEED);

const renderer_string = await g.page.evaluate(() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'unavailable: no webgl2 context';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch (e) { return `unavailable: ${e.message}`; }
});
const software = /swiftshader|llvmpipe|software|mesa/i.test(renderer_string) || /^unavailable/i.test(renderer_string);
console.log(`renderer: ${renderer_string}${software ? '   *** SOFTWARE — cost numbers are an upper bound, appearance claims are not valid ***' : ''}`);

async function shot(file) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  if (file) fs.writeFileSync(path.join(OUT, 'frames', file), buf);
  return buf;
}
/** Same 6/765 threshold W1-30B's probe and the whole W1-30 evidence line already use. */
function diff(a, b) {
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  let n = 0, sum = 0; const tot = A.data.length / 4;
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
    if (d > 6) n++; sum += d;
  }
  return { pct: +(n / tot * 100).toFixed(3), mean: +(sum / tot).toFixed(3) };
}
/**
 * Horizontal-stripe energy in the lower half of the frame, which is what shadow acne on a large
 * terrain LOOKS LIKE numerically: alternating lit/shadowed scanline bands where the depth
 * comparison flips across a texel. Reported so the eye and the number can disagree out loud.
 */
function stripeEnergy(buf) {
  const A = PNG.sync.read(buf); const h = A.height, w = A.width;
  let flips = 0, samples = 0;
  for (let y = Math.floor(h / 2); y < h - 1; y++) {
    for (let x = 0; x < w; x += 4) {
      const i = (y * w + x) * 4, j = ((y + 1) * w + x) * 4;
      const a = 0.2126 * A.data[i] + 0.7152 * A.data[i + 1] + 0.0722 * A.data[i + 2];
      const b = 0.2126 * A.data[j] + 0.7152 * A.data[j + 1] + 0.0722 * A.data[j + 2];
      if (Math.abs(a - b) > 12) flips++;
      samples++;
    }
  }
  return +(flips / samples * 100).toFixed(3);
}

const step = (n) => g.h('stepFrames', n);
const setFeature = (name, on) => g.page.evaluate(({ n, o }) => window.__ENGINE.renderer.sky.setFeature(n, o), { n: name, o: on });

/** Apply a named arm on top of the SHIPPED flags, recording every change for exact restoration. */
async function applyArm(subsets, wrongset = false) {
  return g.page.evaluate(({ subsets, SUBSETS, wrongset }) => {
    const R = window.__ENGINE.renderer;
    window.__SC_RESTORE = window.__SC_RESTORE || [];
    const hit = { cast: 0, receive: 0, names: {} };
    const want = { cast: [], receive: [] };
    for (const s of subsets) {
      want.cast.push(...SUBSETS[s].cast);
      if (!wrongset) want.receive.push(...SUBSETS[s].receive);
    }
    R.scene.traverse((o) => {
      if (!(o.isMesh || o.isInstancedMesh)) return;
      const n = o.name || '';
      if (want.cast.some((p) => n === p || n.startsWith(p)) && !o.castShadow) {
        window.__SC_RESTORE.push([o, 'castShadow', o.castShadow]);
        o.castShadow = true; hit.cast++; hit.names[n] = (hit.names[n] || 0) + 1;
      }
      if (want.receive.some((p) => n === p || n.startsWith(p)) && !o.receiveShadow) {
        window.__SC_RESTORE.push([o, 'receiveShadow', o.receiveShadow]);
        o.receiveShadow = true; hit.receive++;
      }
    });
    return hit;
  }, { subsets, SUBSETS, wrongset });
}
const restoreArm = () => g.page.evaluate(() => {
  for (const [o, k, v] of (window.__SC_RESTORE || [])) o[k] = v;
  window.__SC_RESTORE = [];
});

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
  await g.h('camera', {
    pos: [px, py + height, pz],
    look: [px + Math.sin(yaw) * fwd, py + height + Math.tan(pitch) * fwd, pz + Math.cos(yaw) * fwd],
  });
  await step(2);
  return null;
}

/** Wall-clock ms per frame over PERF_FRAMES single steps, median of the middle band. */
async function frameMs() {
  await step(4);
  const ms = [];
  for (let i = 0; i < PERF_FRAMES; i++) {
    const t0 = process.hrtime.bigint();
    await step(1);
    ms.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  ms.sort((a, b) => a - b);
  return {
    median: +ms[Math.floor(ms.length / 2)].toFixed(2),
    p10: +ms[Math.floor(ms.length * 0.1)].toFixed(2),
    p90: +ms[Math.floor(ms.length * 0.9)].toFixed(2),
  };
}

const out = { tag: TAG, renderer_string, software, seed: SEED, canvas: [CW, CH], time: TIME,
  perf_frames: PERF_FRAMES, build: g.buildInfo || null, rows: [], pageErrors: [] };

const ARMS = args.arms === 'shipped' ? ['base'] : Object.keys(ARM_SETS);

for (const site of SITES) {
  const err = await goTo(site);
  if (err) { out.rows.push({ site, error: err }); console.log(`  RED ${site} — ${err}`); continue; }
  await g.h('setWeather', 'clear');
  await g.h('setTimeOfDay', TIME);
  await step(10);

  for (const arm of ARMS) {
    const hit = await applyArm(ARM_SETS[arm]);
    await step(4);
    const lit = await shot(`${site}-${arm}.png`);
    const perf = await frameMs();
    const stats = await g.page.evaluate(() => ({ ...window.__ENGINE.renderer.lastStats }));
    const fit = await g.page.evaluate(() => window.__ENGINE.renderer.sky.shadowReport());
    // the trivial control, kept because it is the number every other W1-30 report quotes
    await setFeature('shadows', false); await step(3);
    const dark = await shot(null);
    await setFeature('shadows', true); await step(3);
    const row = { site, arm, flagged: hit, shadow_pct: diff(lit, dark).pct, stripe_pct: stripeEnergy(lit),
      frame_ms: perf, drawCalls: stats.drawCalls, triangles: stats.triangles, fit };
    out.rows.push(row);
    console.log(`  ${site.padEnd(22)} ${arm.padEnd(22)} shadow ${String(row.shadow_pct).padStart(6)}%  stripe ${String(row.stripe_pct).padStart(6)}%  ${String(perf.median).padStart(6)} ms  ${stats.drawCalls} calls  cast+${hit.cast} recv+${hit.receive}`);
    await restoreArm();
    await step(2);
  }

  // ---- the null control that is the plausible wrong answer ------------------------------------
  // Casters on, receivers untouched: `province-far` still refuses the shadow and `ground` still
  // does not cast, so the vista gets tree shadows that stop at the tile seam and no landform
  // self-shadowing at all. The arm a hurried fix ships.
  if (ARMS.length > 1) {
    const hit = await applyArm(['near', 'scatter'], true);
    await step(4);
    const lit = await shot(`${site}-wrongset.png`);
    await setFeature('shadows', false); await step(3);
    const dark = await shot(null);
    await setFeature('shadows', true); await step(3);
    const perf = await frameMs();
    out.rows.push({ site, arm: 'wrongset-null-control', flagged: hit, shadow_pct: diff(lit, dark).pct,
      stripe_pct: stripeEnergy(lit), frame_ms: perf });
    console.log(`  ${site.padEnd(22)} ${'wrongset (null ctrl)'.padEnd(22)} shadow ${String(diff(lit, dark).pct).padStart(6)}%  ${String(perf.median).padStart(6)} ms`);
    await restoreArm();
    await step(2);
  }
}

out.pageErrors = g.errors.slice(0, 20);
fs.writeFileSync(path.join(OUT, 'shadow-casters.json'), JSON.stringify(out, null, 2));
console.log(`\nwrote ${path.join(OUT, 'shadow-casters.json')} — ${out.rows.length} rows, ${out.pageErrors.length} page errors`);
await g.close();
