#!/usr/bin/env node
/**
 * w1-30-surface-consumption.mjs — RI-MTH07 for the restored surface shader, and the arm that
 * decides whether the copy-seam fix is real or inert.
 *
 * THE QUESTION. `installSurfaceShader` builds a uniform block — `uWear`, `uWetness`,
 * `uWorldWetness`, `uDetailStrength` — and every census in this project reads it back and calls
 * the material configured. That is exactly the shape of the sixteen subsystems this project has
 * shipped with a correct instrumented model that nothing in the running world reads. So: NAME the
 * consumer, PERTURB the model, and WATCH AN ENTITY CHANGE.
 *
 *   consumer      the fragment shader injected at `#include <lights_physical_fragment>`, which
 *                 reads `uWear` into `material.diffuseColor`/`material.roughness` and
 *                 `uWorldWetness` into both again through the world-height mask.
 *   perturbation  drive that material's OWN uniform objects to an extreme — and DO NOT set
 *                 `needsUpdate`. No recompile is allowed. If the pixels move anyway, the running
 *                 renderer is holding a reference to the very objects the model writes into, which
 *                 is the only thing "consumed" can honestly mean.
 *   entity        the rendered frame of the player, of a settlement building, and of the ground.
 *
 * WHY THERE ARE THREE TARGETS AND WHY THE THIRD ONE IS THE CONTROL. The defect is CONCENTRATED,
 * not universal: the census shows the player's body and the settlement buildings lost the shader
 * to `.clone()` while terrain, water and canopy kept it. So:
 *
 *   player    | affected  -> must NOT move before the fix, MUST move after it
 *   building  | affected  -> must NOT move before the fix, MUST move after it
 *   natural   | UNaffected -> must move in BOTH arms
 *
 * `natural` is the plausible-wrong-answer control, not an empty one. If the before-arm came back
 * all-zero on every target, the honest reading would be "the harness cannot perturb anything" and
 * the whole result would be worthless. `natural` moving in the before-arm is what makes the
 * player and building zeros mean an absence rather than a broken instrument (RULES rule 6, and
 * Ruling W1's note that an empty world fails almost any check by accident).
 *
 * IT ALSO TAKES THE PICTURES, because a statistic can fail this and can never pass it (Ruling W2).
 * Every arm writes PNGs: a full orbit of the player, a building at three angles, the ground at two.
 *
 * Usage:
 *   node tools/visual/w1-30-surface-consumption.mjs --arm after  --out <dir>
 *   node tools/visual/w1-30-surface-consumption.mjs --arm before --out <dir> --gpu hardware --require-hardware
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
import { launchForCapture, resolveGpuMode } from './lib/gpu-launch.mjs';
import { manifestRendererFields, rendererBanner } from './lib/renderer-class.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const ARM = String(args.arm || 'unlabelled');
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/surface-consumption/${ARM}`);
const FRAMES = path.join(OUT, 'frames');
fs.mkdirSync(FRAMES, { recursive: true });
const ORBIT = Number(args.orbit || 8);
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SETTLE = Number(args.settle || 8);

const GPU_MODE = resolveGpuMode(args);
const { g, attestation } = await launchForCapture({
  mode: GPU_MODE,
  requireHardware: args['require-hardware'] === true,
  entry: 'game/index.html', width: 1280, height: 720,
});
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 120000 });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view');
  c.width = w; c.height = h; window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });

console.log(`surface-consumption arm=${ARM} canvas=${CW}x${CH}`);
console.log(rendererBanner(attestation));

// A harness call that cannot kill the run (the pattern deck.mjs settled on: a page-side throw
// reaches `die()` and a try/catch around `g.h` does nothing).
const call = async (m, ...a) => {
  const res = await g.page.evaluate(async ({ method, callArgs }) => {
    const H = window.__HARNESS;
    if (!H || typeof H[method] !== 'function') return { __err: `__HARNESS.${method} missing` };
    try { return { __ok: await H[method](...callArgs) }; } catch (e) { return { __err: `${method}(): ${(e && e.message) || e}` }; }
  }, { method: m, callArgs: a });
  if (res && res.__err) return { ok: false, e: String(res.__err).slice(0, 200) };
  return { ok: true, v: res ? res.__ok : undefined };
};

async function shoot(file) {
  const s = await call('screenshot');
  if (!s.ok) throw new Error(s.e);
  const buf = Buffer.from(String(s.v).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(FRAMES, file), buf);
  return buf;
}
/** Fraction of pixels whose luminance moved by more than `thr` 8-bit levels. */
function movedFraction(a, b, thr = 3) {
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  if (A.width !== B.width || A.height !== B.height) return { frac: 1, note: 'size mismatch' };
  let n = 0; const total = A.width * A.height;
  let maxd = 0, sum = 0;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const la = 0.2126 * A.data[o] + 0.7152 * A.data[o + 1] + 0.0722 * A.data[o + 2];
    const lb = 0.2126 * B.data[o] + 0.7152 * B.data[o + 1] + 0.0722 * B.data[o + 2];
    const d = Math.abs(la - lb);
    if (d > thr) n++;
    if (d > maxd) maxd = d;
    sum += d;
  }
  return { frac: n / total, maxDelta: +maxd.toFixed(2), meanDelta: +(sum / total).toFixed(4) };
}

// ------------------------------------------------------------------------------------------
// The perturbation. Note what it deliberately does NOT do: it never sets `needsUpdate`, so no
// program is recompiled and no `onBeforeCompile` is re-run. The only route from this call to a
// pixel is the renderer already holding these exact uniform objects.
// ------------------------------------------------------------------------------------------
const SELECTORS = {
  player: `(m, mesh, playerSet) => playerSet.has(m)`,
  building: `(m) => !!(m.userData && m.userData.styleboard) || /:style-/.test(m.name || '')`,
  natural: `(m) => !!(m.userData && m.userData.visualFamily) && !(m.userData && m.userData.styleboard)
      && /^(mud|wet_mud|leaf|reed|bark|root|clay)$/.test(m.userData.visualFamily)
      && !/actor-|:style-|held-|shield-/.test(m.name || '')`,
};

async function perturb(target, on) {
  return g.page.evaluate(({ target, on, selectors }) => {
    const R = window.__ENGINE.renderer;
    const playerSet = new Set();
    if (R.playerMesh) R.playerMesh.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) playerSet.add(m); });
    // eslint-disable-next-line no-new-func
    const sel = new Function(`return (${selectors[target]})`)();
    const seen = new Set();
    let touched = 0, hadUniforms = 0;
    R.scene.traverse((o) => {
      if (!o.material) return;
      for (const m of [].concat(o.material)) {
        if (!m || seen.has(m)) continue; seen.add(m);
        if (!sel(m, o, playerSet)) continue;
        touched++;
        const u = m.userData && m.userData.surfaceUniforms;
        if (!u) continue;
        hadUniforms++;
        if (on) {
          if (!m.userData.__consumptionSaved) m.userData.__consumptionSaved = {
            wear: u.uWear.value, wetness: u.uWetness.value, world: u.uWorldWetness.value,
            top: u.uWetTop.value, bottom: u.uWetBottom.value, strength: u.uDetailStrength.value,
          };
          // Extremes, on purpose. A subtle perturbation that fails to move pixels is
          // indistinguishable from a disconnected model.
          u.uWear.value = 1; u.uWetness.value = 1; u.uWorldWetness.value = 1;
          u.uWetTop.value = 500; u.uWetBottom.value = -500; u.uDetailStrength.value = 2.5;
        } else if (m.userData.__consumptionSaved) {
          const s = m.userData.__consumptionSaved;
          u.uWear.value = s.wear; u.uWetness.value = s.wetness; u.uWorldWetness.value = s.world;
          u.uWetTop.value = s.top; u.uWetBottom.value = s.bottom; u.uDetailStrength.value = s.strength;
          delete m.userData.__consumptionSaved;
        }
        // NO m.needsUpdate. See the header.
      }
    });
    return { touched, hadUniforms };
  }, { target, on, selectors: SELECTORS });
}

// ------------------------------------------------------------------------------------------
// Camera work
// ------------------------------------------------------------------------------------------
async function poseOrbit(yawDeg, dist, lookHeight = 1.05, subject = null) {
  const s = await call('snapshot');
  if (!s.ok) return false;
  const [px, py, pz] = subject || s.v.player.pos;
  const yaw = yawDeg * Math.PI / 180, pitch = -6 * Math.PI / 180;
  const eye = [px + Math.sin(yaw) * Math.cos(pitch) * dist, py + 1.4 - Math.sin(pitch) * dist, pz + Math.cos(yaw) * Math.cos(pitch) * dist];
  const r = await call('camera', { pos: eye, look: [px, py + lookHeight, pz] });
  await call('stepFrames', SETTLE);
  return r.ok;
}

// One place for all three targets, so the arms differ only in WHICH MATERIALS are perturbed and
// never in where the camera is. Default is the Deck's `street-lilmoth`: the census names
// `:style-lilmoth-*` as the settlement whose 95 styleboard clones were orphaned, and a street puts
// the player, a building and the ground in one frame.
const [AT_X, AT_Z] = String(args.at || '2779.9,5040.9').split(',').map(Number);
{
  const where = await call('whereAmI');
  if (where.ok && where.v && where.v.interior) await call('exitInterior');
  const t = await call('teleport', AT_X, AT_Z);
  if (!t.ok) console.log(`  WARNING teleport(${AT_X},${AT_Z}) refused: ${t.e} — capturing at spawn instead`);
  await call('stepFrames', 8);
}
await call('setTimeOfDay', 11);
await call('setWeather', 'clear');
await call('stepFrames', 24);

const results = [];

// ---- 1. THE PLAYER, ORBITED THROUGH A FULL CIRCLE ------------------------------------------
// The owner's own words are the reason this is an orbit and not a still: "if you just load the
// game rotate the camera around the player it's immediately obvious that it hasn't [been fixed]".
{
  const per = [];
  for (let i = 0; i < ORBIT; i++) {
    const yaw = Math.round(i * 360 / ORBIT);
    await poseOrbit(yaw, 2.4);
    const base = await shoot(`player-yaw${String(yaw).padStart(3, '0')}-base.png`);
    // NO stepFrames between the three captures. `__HARNESS.screenshot()` calls
    // `engine.loop.renderNow()` itself, so the frame is re-rendered without advancing the
    // simulation — which means the ONLY difference between these three images is the uniform
    // value. The first shakeout DID step two frames between them and the player's idle animation
    // put a 2.5% floor under a 5.5% signal; the instrument was measuring its own subject breathing.
    const cnt = await perturb('player', true);
    const pert = await shoot(`player-yaw${String(yaw).padStart(3, '0')}-perturbed.png`);
    await perturb('player', false);
    const rest = await shoot(`player-yaw${String(yaw).padStart(3, '0')}-restored.png`);
    per.push({ yaw, materials_selected: cnt.touched, with_uniforms: cnt.hadUniforms,
      perturbed: movedFraction(base, pert), restored_floor: movedFraction(base, rest) });
    console.log(`  player yaw ${yaw}: ${cnt.hadUniforms}/${cnt.touched} materials had uniforms, `
      + `moved ${(per.at(-1).perturbed.frac * 100).toFixed(2)}% (floor ${(per.at(-1).restored_floor.frac * 100).toFixed(2)}%)`);
  }
  results.push({ target: 'player', angles: per });
}

// ---- 2. A BUILDING SURFACE, AT THREE ANGLES -------------------------------------------------
{
  const per = [];
  for (const yaw of [20, 140, 260]) {
    await poseOrbit(yaw, 9, 3.0);
    const base = await shoot(`building-yaw${yaw}-base.png`);
    const cnt = await perturb('building', true);
    const pert = await shoot(`building-yaw${yaw}-perturbed.png`);
    await perturb('building', false);
    const rest = await shoot(`building-yaw${yaw}-restored.png`);
    per.push({ yaw, materials_selected: cnt.touched, with_uniforms: cnt.hadUniforms,
      perturbed: movedFraction(base, pert), restored_floor: movedFraction(base, rest) });
    console.log(`  building yaw ${yaw}: ${cnt.hadUniforms}/${cnt.touched} materials had uniforms, `
      + `moved ${(per.at(-1).perturbed.frac * 100).toFixed(2)}% (floor ${(per.at(-1).restored_floor.frac * 100).toFixed(2)}%)`);
  }
  results.push({ target: 'building', angles: per });
}

// ---- 3. THE GROUND — the positive control, unaffected by the defect in either arm ------------
{
  const per = [];
  for (const yaw of [0, 180]) {
    await poseOrbit(yaw, 6, 0.2);
    const base = await shoot(`natural-yaw${yaw}-base.png`);
    const cnt = await perturb('natural', true);
    const pert = await shoot(`natural-yaw${yaw}-perturbed.png`);
    await perturb('natural', false);
    const rest = await shoot(`natural-yaw${yaw}-restored.png`);
    per.push({ yaw, materials_selected: cnt.touched, with_uniforms: cnt.hadUniforms,
      perturbed: movedFraction(base, pert), restored_floor: movedFraction(base, rest) });
    console.log(`  natural yaw ${yaw}: ${cnt.hadUniforms}/${cnt.touched} materials had uniforms, `
      + `moved ${(per.at(-1).perturbed.frac * 100).toFixed(2)}% (floor ${(per.at(-1).restored_floor.frac * 100).toFixed(2)}%)`);
  }
  results.push({ target: 'natural', angles: per });
}

const best = (t) => Math.max(...results.find((r) => r.target === t).angles.map((a) => a.perturbed.frac));
const floor = (t) => Math.max(...results.find((r) => r.target === t).angles.map((a) => a.restored_floor.frac));

const checks = [
  // The control has to work before either verdict below can be read at all.
  { id: 'CONTROL-NATURAL-RESPONDS', ok: best('natural') > Math.max(0.01, floor('natural') * 3),
    detail: `unaffected ground surfaces moved ${(best('natural') * 100).toFixed(2)}% of pixels against a restore floor of ${(floor('natural') * 100).toFixed(2)}% — if this fails, nothing else in this run means anything` },
  { id: 'RESTORE-IS-CLEAN', ok: Math.max(floor('player'), floor('building'), floor('natural')) < 0.02,
    detail: `worst restore-to-baseline drift ${(Math.max(floor('player'), floor('building'), floor('natural')) * 100).toFixed(2)}%` },
  { id: 'PLAYER-CONSUMES', ok: best('player') > Math.max(0.005, floor('player') * 3),
    detail: `player moved ${(best('player') * 100).toFixed(2)}% at its best angle (floor ${(floor('player') * 100).toFixed(2)}%)` },
  { id: 'BUILDING-CONSUMES', ok: best('building') > Math.max(0.005, floor('building') * 3),
    detail: `buildings moved ${(best('building') * 100).toFixed(2)}% at their best angle (floor ${(floor('building') * 100).toFixed(2)}%)` },
];

const out = { arm: ARM, canvas: [CW, CH], ...manifestRendererFields(attestation), results, checks,
  pageErrors: g.errors.slice(0, 10) };
fs.writeFileSync(path.join(OUT, 'consumption.json'), JSON.stringify(out, null, 2));
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id}  — ${c.detail}`);
console.log(`frames in ${FRAMES}`);
await g.close();
// The BEFORE arm is EXPECTED to fail PLAYER-CONSUMES and BUILDING-CONSUMES. Exit code is
// informational; the two arms together are the result, not either one alone.
process.exit(0);
