#!/usr/bin/env node
/**
 * w1-30-fog-owner-ab.mjs — WHICH atmosphere implementation is the better picture?
 *
 * WRITTEN BY THE CRITIC OF W1-30-SHADOW-CASTERS, NOT BY ITS BUILDER.
 *
 * THE QUESTION. `game/src/world/aerial.js` and `game/src/render/sky.js` each patch the SAME four
 * `THREE.ShaderChunk` fog chunks at module scope. `renderer.js` imports `./sky.js` before
 * `../world/province.js`, so whichever of them installs LAST owns the fog model for the whole
 * build, and the loser's feature switches keep appearing to work because they toggle state the
 * shader no longer reads. Until this round `aerial.js` won. W1-30-SHADOW-CASTERS commented out
 * `installAerialPerspective()` and ruled (R1) that `sky.js`'s model is the better one, naming its
 * own overturning evidence: *"a capture showing sky.js's model is the WORSE picture."*
 *
 * This tool takes that capture. It is the arm that can overturn R1, so it is deliberately built to
 * be able to: both arms are the same repo, the same thirteen Deck vistas, the same seed, the same
 * hour, the same weather, the same canvas. The ONE thing that differs is which module's four
 * strings are in `THREE.ShaderChunk` — a one-line source difference (`installAerialPerspective()`
 * commented or not) that this tool does not make itself; it reads the answer back OFF THE LIVE
 * PAGE and stamps it into the report, so an arm that failed to flip is visible rather than
 * silently duplicated.
 *
 * HAZARDS §0'S FIFTH FAILURE SHAPE — WHICH INPUT DO ALL THE ARMS SUPPLY IDENTICALLY? The region
 * records, the terrain raster and the camera list, and that is correct here: those are the shared
 * WORLD both models are being asked to draw, and neither arm fabricates them — they are read off
 * disk by the running game. Nothing this tool computes is derived from a table that also decides
 * the answer. The disputed quantity is the CHUNK OWNER, and no arm asserts it: both read it out of
 * `THREE.ShaderChunk.fog_fragment` in the page and the report carries the string.
 *
 * WHAT IT MEASURES. The frames, through `frame-stats.mjs` — the same screen W1-30F's "9 of 13
 * unusable -> 5 of 13" claim was made with, so the numbers are comparable to the ones on the
 * table. Plus `scene.fog` state and the fog wall: the distance at which the model reaches 95%
 * opacity, computed in JS from the SAME two floats the shader reads, for a level ray.
 *
 * Usage:
 *   node tools/visual/w1-30-fog-owner-ab.mjs --tag head --out reports/visual-truth/fog-owner/head
 *   node tools/visual/w1-30-fog-owner-ab.mjs --tag aerial --out ... --repo <control-clone>
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
const TAG = String(args.tag || 'head');
const OUT = path.resolve(process.cwd(), args.out || `reports/visual-truth/fog-owner/${TAG}`);
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
const TIME = Number(args.time || 13);
const SITES = args.sites ? String(args.sites).split(',')
  : DECK.setups.filter((s) => s.block === 'region-vista').map((s) => s.id);

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

/** Read the disputed input out of the page instead of asserting it. */
const chunkOwner = await g.page.evaluate(async () => {
  // Page-relative on purpose: this tool is run against a control clone too, where the served
  // root is <clone>/game and an absolute `/game/...` specifier would 404.
  const THREE = await import('./vendor/three/three.module.js');
  const f = String(THREE.ShaderChunk.fog_fragment || '');
  const v = String(THREE.ShaderChunk.fog_vertex || '');
  return {
    fog_fragment: /esAerialScale/.test(f) ? 'world/aerial.js' : (/esSigma0/.test(f) ? 'render/sky.js' : 'three stock'),
    fog_vertex: /vFogWorldY/.test(v) ? (/viewMatrix\[0\]\[1\]/.test(v) ? 'world/aerial.js' : 'render/sky.js') : 'three stock',
    uAerial_declared: /uAerial/.test(String(THREE.ShaderChunk.fog_pars_fragment || '')),
  };
});
console.log(`chunk owner: ${JSON.stringify(chunkOwner)}`);

async function shot(file) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(OUT, 'frames', file), buf);
  return buf;
}

async function goTo(site) {
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

/**
 * The fog wall: how far a level ray travels before the model paints 95% fog colour, using the two
 * floats the shader actually reads. Both models are evaluated here so the report can say which
 * arithmetic the frame was produced by, and both are the SHADER's arithmetic, transcribed once.
 */
function fogWall(owner, sigma0OrNear, hOrFar, camY) {
  const opaque = 0.95;
  for (let d = 1; d <= 4000; d += 1) {
    let f;
    if (owner === 'render/sky.js') {
      const H = hOrFar;
      // level ray: yf == yc, so the ratio term degenerates to 1
      const tau = H <= 0 ? sigma0OrNear * d : sigma0OrNear * d * Math.exp(-camY / H);
      f = 1 - Math.exp(-Math.max(tau, 0));
    } else if (owner === 'world/aerial.js') {
      // scene.fog is HeightFog extends THREE.Fog -> isFog, NOT isFogExp2, so aerial.js's chunk
      // takes its `#else` branch: smoothstep(fogNear, fogFar, depth * esAerial). fogNear is
      // sigma0 (~0.0068) and fogFar is H (26..340) because HeightFog repurposed them.
      const t = Math.min(1, Math.max(0, (d - sigma0OrNear) / (hOrFar - sigma0OrNear)));
      f = t * t * (3 - 2 * t);
    } else {
      f = 1 - Math.exp(-Math.pow(sigma0OrNear * d, 2));
    }
    if (f >= opaque) return d;
  }
  return null;
}

const out = {
  tag: TAG, chunk_owner: chunkOwner, canvas: [CW, CH], seed: SEED, time: TIME,
  renderer_string: await g.page.evaluate(() => {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'none'));
    } catch (e) { return `unavailable: ${e.message}`; }
  }),
  rows: [], pageErrors: [],
};

for (const site of SITES) {
  const err = await goTo(site);
  if (err) { out.rows.push({ site, error: err }); console.log(`  RED ${site} — ${err}`); continue; }
  await g.h('setWeather', 'clear');
  await g.h('setTimeOfDay', TIME);
  await step(12);
  await shot(`${site}.png`);
  const st = await g.page.evaluate(() => {
    const R = window.__ENGINE.renderer, sc = R.scene;
    return {
      sigma0: sc.fog ? sc.fog.sigma0 ?? sc.fog.near : null,
      H: sc.fog ? sc.fog.heightFalloff ?? sc.fog.far : null,
      isFogExp2: !!(sc.fog && sc.fog.isFogExp2),
      camY: R.camera.position.y,
      aerialH: R.province ? R.province._aerialH : null,
      aerialInstalled: null,
    };
  });
  st.fog_wall_m = fogWall(chunkOwner.fog_fragment, st.sigma0, st.H, st.camY);
  out.rows.push({ site, ...st });
  console.log(`  ${site.padEnd(26)} sigma0 ${String(st.sigma0).padStart(8)}  H ${String(st.H).padStart(6)}  camY ${st.camY.toFixed(1).padStart(7)}  95% fog at ${st.fog_wall_m} m`);
}

out.pageErrors = g.errors.slice(0, 20);
fs.writeFileSync(path.join(OUT, 'fog-owner.json'), JSON.stringify(out, null, 2));
console.log(`\nwrote ${path.join(OUT, 'fog-owner.json')}`);
await g.close();
