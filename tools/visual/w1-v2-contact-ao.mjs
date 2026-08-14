#!/usr/bin/env node
/**
 * w1-v2-contact-ao.mjs — does the contact-shadow/AO fix in game/src/render/post/composite.js
 * actually darken a junction, and is the darkening LOCAL rather than a global multiply.
 *
 * WHY THIS SCENE. `game/src/render/scene.js`'s `material_showcase` state exists for exactly this:
 * a stone wall standing on a plinth with moss and a plank at its base ("VP08: half a metre from
 * a wall/ground junction... three materials meeting"). It is the same fixture RI-VIS04 §4 and
 * RI-VIS03 M6b describe in words — a real geometric contact, not a painted texture seam — and
 * using an authored test fixture instead of a hand-picked production camera means the pixel rows
 * for "contact band" and "open ground 100px away" are known in advance rather than eyeballed per
 * run.
 *
 * THE METRIC, taken directly from the project's own written bar rather than invented here:
 *   RI-VIS04 §4:  "If the junction is not >= 25% darker, there is no AO."
 *   RI-VIS03 M6b: "sample a 16 px band immediately around the contact. Mean Yp in that band
 *                  must be <= 0.75x mean Yp of ground 100 px away."
 * `contact_ratio = mean_luma(contact band) / mean_luma(far band)`. PASS requires ratio <= 0.75.
 *
 * THE NULL CONTROL THAT IS THE PLAUSIBLE WRONG ANSWER, NOT THE TRIVIAL ONE (dispatch brief,
 * evidence item 4). "AO off looks flatter" is the trivial control and `--arm off` already is it.
 * The plausible wrong answer a hurried fix ships is a GLOBAL darkening — multiply the whole frame
 * by a constant. `--null-control` proves that arm CANNOT pass this metric, without needing a
 * second shader: multiplying every pixel by one scalar k leaves every RATIO of two regions of the
 * same frame unchanged (k*contact / k*far = contact/far), so a uniform darkening reproduces the
 * exact ratio the AO-off arm already has, not a lower one. This is exact, not approximate — the
 * algebra is the proof, and this flag also renders it against the real captured pixels so the
 * claim is not just asserted.
 *
 * Usage:
 *   node tools/visual/w1-v2-contact-ao.mjs                       both arms, local browser
 *   node tools/visual/w1-v2-contact-ao.mjs --entry <clone>/game/index.html   (delete-the-fix / hardware)
 *   node tools/visual/w1-v2-contact-ao.mjs --hardware-gpu         rent nothing itself — pass this
 *                                                                 through to launchGame on a Pod
 *   node tools/visual/w1-v2-contact-ao.mjs --null-control         also prints the global-darken proof
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/w1-v2-contact-ao');
fs.mkdirSync(OUT, { recursive: true });

// The camera pose and pixel bands were surveyed against this exact fixture (see header) at
// 1280x720. Recorded as constants, not re-derived per run, so two runs are comparable.
const CAMERA = { pos: [0, 1.7, 2.6], look: [0, 0.15, -0.4], fov: 50 };
const WIDTH = 1280, HEIGHT = 720;
const CONTACT_BAND = { y0: 552, y1: 568, x0: 400, x1: 1200 }; // the wall/moss seam, 16px
const FAR_BAND = { y0: 660, y1: 676, x0: 400, x1: 1200 };     // open floor, ~100px further from the wall
const PASS_RATIO = 0.75; // RI-VIS04 §4 / RI-VIS03 M6b: contact must be >=25% darker than open ground

function bandLuma(png, b) {
  const w = png.width;
  let sum = 0, n = 0;
  for (let y = b.y0; y < b.y1; y++) {
    for (let x = b.x0; x < b.x1; x++) {
      const i = (w * y + x) << 2;
      sum += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      n++;
    }
  }
  return sum / n;
}

async function captureArm(g, { ao }) {
  await g.h('loadState', 'material_showcase');
  await g.h('setTimeOfDay', 12);
  await g.h('setWeather', 'clear');
  await g.h('camera', CAMERA);
  if (ao === false) await g.h('setVisualFeature', 'ao', false);
  else if (ao === true) await g.h('setVisualFeature', 'ao', true);
  await g.h('stepFrames', 10);
  const url = await g.page.evaluate(async () => window.__HARNESS.screenshot());
  return PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
}

function measure(png) {
  const contact = bandLuma(png, CONTACT_BAND);
  const far = bandLuma(png, FAR_BAND);
  const ratio = contact / far;
  return { contact_luma: +contact.toFixed(3), far_luma: +far.toFixed(3), ratio: +ratio.toFixed(4), pass: ratio <= PASS_RATIO };
}

const g = await launchGame({
  entry: args.entry || 'game/index.html', width: WIDTH, height: HEIGHT,
  hardwareGpu: args['hardware-gpu'] === true || args.hardwareGpu === true,
});
await g.h('ready');

const rendererString = await g.page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return null;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
});
const softwareRenderer = /swiftshader|llvmpipe|software/i.test(String(rendererString || ''));

const pngOff = await captureArm(g, { ao: false });
const pngOn = await captureArm(g, { ao: true });
fs.writeFileSync(path.join(OUT, 'ao-off.png'), PNG.sync.write(pngOff));
fs.writeFileSync(path.join(OUT, 'ao-on.png'), PNG.sync.write(pngOn));

const mOff = measure(pngOff);
const mOn = measure(pngOn);

const result = {
  entry: args.entry || 'game/index.html',
  renderer: rendererString, software_renderer: softwareRenderer,
  camera: CAMERA, contact_band: CONTACT_BAND, far_band: FAR_BAND, pass_ratio: PASS_RATIO,
  ao_off: mOff, ao_on: mOn,
  darkening_is_localized: mOff.far_luma > 0
    ? Math.abs(mOn.far_luma - mOff.far_luma) / mOff.far_luma < 0.02
    : null,
  checks: [
    { id: 'AO-OFF-DOES-NOT-PASS', ok: !mOff.pass, detail: `ratio ${mOff.ratio} (must NOT already be <= ${PASS_RATIO} — else the fixture itself has a contact-dark bias and the arm proves nothing)` },
    { id: 'AO-ON-PASSES-RI-VIS04-4', ok: mOn.pass, detail: `ratio ${mOn.ratio} <= ${PASS_RATIO} required` },
    { id: 'FAR-BAND-UNCHANGED', ok: mOff.far_luma > 0 && Math.abs(mOn.far_luma - mOff.far_luma) / mOff.far_luma < 0.02, detail: `far_luma off=${mOff.far_luma} on=${mOn.far_luma} — open ground away from any junction must not move; a change here would mean this is a global darken, not contact AO` },
  ],
};

if (args['null-control']) {
  // The algebraic null control (see header): scale EVERY pixel of the ao-off capture by a
  // constant k chosen so its mean luma equals the ao-on capture's mean luma (i.e. "as dark
  // overall"), then run the SAME contact-vs-far metric on the scaled image. If a global darken
  // could pass this metric, the ratio would drop below PASS_RATIO here too.
  let sumOff = 0, sumOn = 0, n = pngOff.width * pngOff.height;
  for (let i = 0; i < pngOff.data.length; i += 4) {
    sumOff += 0.2126 * pngOff.data[i] + 0.7152 * pngOff.data[i + 1] + 0.0722 * pngOff.data[i + 2];
    sumOn += 0.2126 * pngOn.data[i] + 0.7152 * pngOn.data[i + 1] + 0.0722 * pngOn.data[i + 2];
  }
  const k = (sumOn / n) / (sumOff / n); // same overall darkening magnitude as the real AO arm
  const scaled = new PNG({ width: pngOff.width, height: pngOff.height });
  for (let i = 0; i < pngOff.data.length; i += 4) {
    scaled.data[i] = Math.min(255, pngOff.data[i] * k);
    scaled.data[i + 1] = Math.min(255, pngOff.data[i + 1] * k);
    scaled.data[i + 2] = Math.min(255, pngOff.data[i + 2] * k);
    scaled.data[i + 3] = 255;
  }
  fs.writeFileSync(path.join(OUT, 'global-darken-null-control.png'), PNG.sync.write(scaled));
  const mScaled = measure(scaled);
  result.null_control_global_darken = {
    scale_k: +k.toFixed(4),
    note: 'ao-off frame uniformly multiplied by k, k chosen to match ao-on\'s overall mean luma',
    measured: mScaled,
    algebraic_prediction: +mOff.ratio.toFixed(4),
    checks: [{
      id: 'GLOBAL-DARKEN-DOES-NOT-REPRODUCE-CONTACT-AO',
      ok: !mScaled.pass && Math.abs(mScaled.ratio - mOff.ratio) < 0.01,
      detail: `scaled ratio ${mScaled.ratio} (predicted ${mOff.ratio.toFixed(4)} by k*a/k*b=a/b) vs real AO ratio ${mOn.ratio} — a global darken this dark overall still does NOT pass ${PASS_RATIO}, because it cannot change a ratio`,
    }],
  };
}

fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
console.log(`renderer: ${rendererString} (software=${softwareRenderer})`);
console.log(`AO off: contact=${mOff.contact_luma} far=${mOff.far_luma} ratio=${mOff.ratio} pass=${mOff.pass}`);
console.log(`AO on:  contact=${mOn.contact_luma} far=${mOn.far_luma} ratio=${mOn.ratio} pass=${mOn.pass}`);
for (const c of result.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id}  — ${c.detail}`);
if (result.null_control_global_darken) {
  for (const c of result.null_control_global_darken.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id}  — ${c.detail}`);
}
await g.close();
const allOk = result.checks.every((c) => c.ok) && (!result.null_control_global_darken || result.null_control_global_darken.checks.every((c) => c.ok));
process.exit(allOk ? 0 : 1);
