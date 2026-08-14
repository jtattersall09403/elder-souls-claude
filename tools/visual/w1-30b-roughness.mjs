#!/usr/bin/env node
/**
 * w1-30b-roughness.mjs — the roughness-sphere rig. A permanent instrument, not a one-off check.
 *
 * THE QUESTION IT ANSWERS. `MeshStandardMaterial` claims a roughness, and the only thing that makes
 * that claim visible is the image-based environment: a smooth surface reflects a sharp image of the
 * world, a rough one reflects a blurred average of it. If the environment has no roughness-convolved
 * mip chain, every material in the build reflects the same blob whatever it says about itself, and
 * twenty authored material sets with detail normals, wear and wetness masks cannot show.
 *
 * The shipped build's environment was a 16x8 byte `DataTexture` — 128 texels, clamped at 1.0, and
 * (this is the part nobody had noticed) converted to a cubeUV by three.js exactly ONCE and cached
 * on the texture object for the lifetime of the page, because `WebGLCubeUVMaps` only re-converts
 * render-target textures. Rewriting its bytes every frame, which is what `sky.js` did, changed
 * nothing a material could see.
 *
 * WHAT IT DOES. Four dielectric spheres at roughness 0.05 / 0.3 / 0.6 / 0.9 are placed in front of
 * the camera against the sky, lit only by `scene.environment` (the sun, hemisphere and fill are
 * zeroed for the shot so the measurement is of the probe and nothing else). Each sphere's disc is
 * measured for mean luminance, luminance spread, and the number of distinguishable horizontal
 * luminance bands down its face — the last is the plan's test that the smooth sphere resolves
 * recognisable sky/horizon structure rather than a uniform fill.
 *
 * THE CONTROL IS THE PLAUSIBLE WRONG ANSWER. `--null` rebuilds the shipped build's own 16x8 byte
 * environment from the same live sky colours and re-measures. It is not "no environment", which
 * would be red against anything; it is the environment somebody shipped, and the plan's row is that
 * under it all four spheres collapse to within 8% mean luminance of each other.
 *
 *   node tools/visual/w1-30b-roughness.mjs --tag after
 *   node tools/visual/w1-30b-roughness.mjs --tag after --hardware
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
const TAG = String(args.tag || 'roughness');
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/w1-30b/${TAG}`);
fs.mkdirSync(OUT, { recursive: true });
const HW = args.hardware === true || process.env.VT_HARDWARE_GPU === '1';
const [CW, CH] = String(args.canvas || '1024x320').split('x').map(Number);
const ROUGH = [0.05, 0.3, 0.6, 0.9];

const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));

const g = await launchGame({ entry: 'game/index.html', width: CW, height: CH, hardwareGpu: HW });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setTimeOfDay', 13);
await g.h('setWeather', 'clear');
await g.h('stepFrames', 20);

const renderer_string = await g.page.evaluate(() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    return String(e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch (e) { return `unavailable: ${e.message}`; }
});
const software = /swiftshader|llvmpipe|software|mesa/i.test(renderer_string);
console.log(`renderer: ${renderer_string}${software ? '   *** SOFTWARE — IBL is one of the things SwiftShader approximates; this is a floor, not a verdict ***' : ''}`);

// ---- build the rig in the page -------------------------------------------------------------
await g.page.evaluate(async ({ rough }) => {
  const THREE = await import('/game/vendor/three/three.module.js');
  const R = window.__ENGINE.renderer;
  const rig = new THREE.Group();
  rig.name = 'w1-30b-roughness-rig';
  const geo = new THREE.SphereGeometry(1, 48, 32);
  window.__W1B = { THREE, rig, spheres: [] };
  for (let i = 0; i < rough.length; i++) {
    const m = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.0, roughness: rough[i] });
    m.userData.visualFamily = 'instrument.roughness-probe';
    const s = new THREE.Mesh(geo, m);
    s.position.set((i - (rough.length - 1) / 2) * 2.6, 0, 0);
    s.name = `roughness-${rough[i]}`;
    rig.add(s); window.__W1B.spheres.push(s);
  }
  R.scene.add(rig);
  // WHY THIS DRAWS THE FRAME ITSELF RATHER THAN CALLING renderer.render(sim).
  //
  // The first version of this rig zeroed the analytic lights, then called `renderer.render(sim)` —
  // which begins by calling `sky.apply()`, which writes every light intensity and `scene.environment`
  // back from the weather table. So nothing was zeroed at draw time, the spheres were lit by the sun
  // and the hemisphere, and the null arm's substituted environment had already been overwritten. The
  // measured result was the real probe and the shipped 16x8 one agreeing to within 1% — a rig
  // reporting that its own subject makes no difference, which is exactly the shape of instrument
  // this project keeps having to throw away. Everything below runs AFTER apply(), in the same tick
  // as the draw, and issues the draw itself.
  window.__W1B.shoot = (envOverride) => {
    const cam = R.camera;
    const f = new THREE.Vector3(); cam.getWorldDirection(f);
    rig.position.copy(cam.position).add(f.multiplyScalar(9));
    rig.quaternion.copy(cam.quaternion);
    // Only the environment lights the spheres. Anything else and the number is about the sun.
    R.sky.sun.intensity = 0; R.sky.moon.intensity = 0;
    R.sky.hemi.intensity = 0; R.sky.fill.intensity = 0;
    if (envOverride !== undefined) R.scene.environment = envOverride;
    R.three.setRenderTarget(null);
    R.three.render(R.scene, cam);
  };
}, { rough: ROUGH });

async function shootAndMeasure(file, useNull = false) {
  await g.h('stepFrames', 2);
  await g.page.evaluate((n) => window.__W1B.shoot(n ? window.__W1B.nullTex : undefined), useNull);
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(OUT, file), buf);
  const img = PNG.sync.read(buf);
  // Each sphere occupies its own vertical slice of the frame; measure the central disc of each.
  const slice = img.width / ROUGH.length;
  return ROUGH.map((r, i) => {
    const cx = Math.round(slice * (i + 0.5)), cy = Math.round(img.height / 2);
    const rad = Math.round(Math.min(slice, img.height) * 0.30);
    const rows = [];
    let sum = 0, n = 0, mn = 1e9, mx = -1e9;
    for (let dy = -rad; dy <= rad; dy++) {
      let rs = 0, rn = 0;
      const half = Math.floor(Math.sqrt(Math.max(0, rad * rad - dy * dy)) * 0.92);
      for (let dx = -half; dx <= half; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
        const p = (y * img.width + x) * 4;
        const L = 0.2126 * img.data[p] + 0.7152 * img.data[p + 1] + 0.0722 * img.data[p + 2];
        rs += L; rn++; sum += L; n++; if (L < mn) mn = L; if (L > mx) mx = L;
      }
      if (rn > 0) rows.push(rs / rn);
    }
    // "distinguishable luminance bands vertically": walk the per-row means and count runs
    // separated by more than 4/255, which is a step a viewer can see on a smooth gradient.
    let bands = 1, last = rows[0];
    for (const v of rows) { if (Math.abs(v - last) > 4) { bands++; last = v; } }
    return {
      roughness: r, mean: +(sum / Math.max(1, n)).toFixed(2),
      min: +mn.toFixed(1), max: +mx.toFixed(1), spread: +(mx - mn).toFixed(1),
      vertical_bands: bands,
    };
  });
}

const result = { tag: TAG, renderer_string, software, roughness: ROUGH };
result.real = await shootAndMeasure('roughness-real.png');
console.log('\nreal probe:');
for (const r of result.real) console.log(`  roughness ${String(r.roughness).padEnd(5)} mean ${String(r.mean).padEnd(8)} spread ${String(r.spread).padEnd(7)} bands ${r.vertical_bands}`);

// ---- the null control: the shipped build's own 16x8 byte environment ------------------------
await g.page.evaluate(async () => {
  const THREE = await import('/game/vendor/three/three.module.js');
  const R = window.__ENGINE.renderer, sky = R.sky, sc = R.scene;
  // Rebuilt verbatim from the pre-W1-30B source: 16x8, RGBA byte, sRGB, equirect, hot sample
  // following the sun direction. This is the environment that shipped, not an empty one.
  const bytes = new Uint8Array(16 * 8 * 4);
  const hor = sky.uniforms.uHorizon.value, zen = sky.uniforms.uZenith.value;
  const dir = sky.uniforms.uSunDir.value, sc3 = sky.uniforms.uSunColour.value;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
    const i = (y * 16 + x) * 4, t = 1 - y / 7;
    const c = hor.clone().lerp(zen, t);
    const a = x / 16 * Math.PI * 2, sy = (0.5 - y / 7) * Math.PI;
    const s = new THREE.Vector3(Math.cos(a) * Math.cos(sy), Math.sin(sy), Math.sin(a) * Math.cos(sy));
    const hot = Math.pow(Math.max(0, s.dot(dir)), 48) * (1 - sky.uniforms.uOvercast.value) * 2.2;
    bytes[i] = Math.min(255, Math.round((c.r + sc3.r * hot) * 255));
    bytes[i + 1] = Math.min(255, Math.round((c.g + sc3.g * hot) * 255));
    bytes[i + 2] = Math.min(255, Math.round((c.b + sc3.b * hot) * 255));
    bytes[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(bytes, 16, 8, THREE.RGBAFormat);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.name = 'w1-30-dynamic-environment-ibl';
  tex.needsUpdate = true;
  window.__W1B.nullTex = tex;
});
// `shoot(nullTex)` substitutes it AFTER apply() has written scene.environment, in the same tick as
// the draw — the only point at which a substitution survives to the frame.
result.null_control = await shootAndMeasure('roughness-null.png', true);
console.log('\nnull control (the shipped 16x8 byte environment):');
for (const r of result.null_control) console.log(`  roughness ${String(r.roughness).padEnd(5)} mean ${String(r.mean).padEnd(8)} spread ${String(r.spread).padEnd(7)} bands ${r.vertical_bands}`);

// ---- the rows ------------------------------------------------------------------------------
const spread = (rows) => {
  const m = rows.map((r) => r.mean);
  const lo = Math.min(...m), hi = Math.max(...m);
  return { lo, hi, rel: lo > 0 ? +((hi - lo) / lo * 100).toFixed(2) : Infinity };
};
result.real_spread = spread(result.real);
result.null_spread = spread(result.null_control);
result.rows = {
  four_distinct: result.real_spread.rel >= 8,
  smooth_resolves_structure: result.real[0].vertical_bands >= 3,
  null_collapses: result.null_spread.rel < 8,
};
fs.writeFileSync(path.join(OUT, 'roughness.json'), JSON.stringify(result, null, 2));
console.log('');
console.log(`real spread across the four spheres: ${result.real_spread.rel}%  (row wants >= 8%)  -> ${result.rows.four_distinct ? 'PASS' : 'FAIL'}`);
console.log(`roughness 0.05 vertical bands:       ${result.real[0].vertical_bands}  (row wants >= 3)   -> ${result.rows.smooth_resolves_structure ? 'PASS' : 'FAIL'}`);
console.log(`null control spread:                 ${result.null_spread.rel}%  (row wants < 8%)   -> ${result.rows.null_collapses ? 'RED as required' : 'NOT RED'}`);
console.log(`wrote ${path.join(OUT, 'roughness.json')}`);
await g.close();
