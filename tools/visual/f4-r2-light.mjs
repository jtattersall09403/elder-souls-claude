#!/usr/bin/env node
/**
 * f4-r2-light.mjs — roadmap F4 ROUND 2's own instrument. Written by the R2 BUILDER.
 *
 * It exists for three questions the round-1 critic's `f4c-critic.mjs` does not answer, and it
 * deliberately reuses that tool's page-side mechanics verbatim so the two are comparable:
 *
 *  1. `--mode hoursweep` — WHY IS THERE NO BUILDING SHADOW ON THE GROUND AT 08:00?
 *     The r1 critic measured, over twelve camera angles, large readable cast shadows at 13:00 and
 *     none at 08:00. This mode holds ONE pose and ONE arm fixed and walks the clock, capturing
 *     `base` and `shadows_off` at each hour, so the cast-shadow area fraction becomes a CURVE
 *     against sun elevation. A defect and a sun-angle fact look different on that curve: a fact is
 *     monotone in elevation, a defect has a hole in it. The sun's own elevation, azimuth, the
 *     shadow fit's radius/texel/bias and the live light intensities are read back per hour, so the
 *     cause is in the data rather than in an argument.
 *
 *  2. `--mode weather` — THE COVERAGE HOLE. `overcast-flat` and `storm` are selected for the
 *     majority of daylight across the thirteen regions' weather machines and neither has ever been
 *     captured. Same arms as the S60 battery, at 13:00, in clear / overcast / storm.
 *
 *  3. `--mode angles` — M6 ACROSS AN ORBIT AT AN ARBITRARY HOUR with the shadow ablation attached,
 *     because the standing directive is that stills from one angle are not evidence, and because
 *     `RI-VIS04` §3-D3 needs `retention`/`C_shadow` measured in the same windows whose cast-shadow
 *     area moved.
 *
 * ARMS. `--entry <tree>/game/index.html` serves THAT tree (`tools/lib/browser.mjs` roots the static
 * server at the entry's own directory when the entry is outside the repo). HAZARDS §22's trap is a
 * tool that ignores `--entry` and silently measures the main tree; the guard here is that every
 * manifest records the entry path, the sha256 of the two lighting source files AS SERVED, and the
 * live readback of sun/moon/hemisphere/env — two arms that differ in source and agree in readback
 * did not both load.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { launchForCapture, resolveGpuMode } from './lib/gpu-launch.mjs';
import { gateBuffer } from './frame-liveness.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const MODE = String(args.mode || 'hoursweep');
const ARM = String(args.arm || 'landed');
const ENTRY = String(args.entry || 'game/index.html');
const OUT = path.resolve(REPO, args.out || `reports/f4r2/${MODE}-${ARM}`);
fs.mkdirSync(OUT, { recursive: true });

const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/blind/deck-protocol-a.json'), 'utf8'));
const SEED = Number(DECK.capture.seed);
const SETTLE = Number(DECK.capture.settle_frames);

/** The lighting source as SERVED by this arm — HAZARDS §22's discriminator, recorded not argued. */
function servedSources(entry) {
  const gameDir = path.dirname(path.resolve(entry));
  const out = {};
  for (const rel of ['src/render/lib/lighting-recipes.js', 'src/render/sky.js']) {
    const p = path.join(gameDir, rel);
    out[rel] = fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16) : null;
  }
  return { game_dir: gameDir, sha256_16: out };
}

const [CW, CH] = String(args.res || '1920x1080').split('x').map(Number);

const { g, attestation } = await launchForCapture({
  mode: resolveGpuMode(args), requireHardware: args['require-hardware'] === true,
  entry: ENTRY, width: 1280, height: 720,
});
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 180000 });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view');
  c.width = w; c.height = h; window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', SEED);

// ---- page-side helpers. Copied from f4c-critic.mjs so the two instruments agree by construction.
const setupOk = await g.page.evaluate(() => {
  const R = window.__ENGINE.renderer;
  window.__scene = () => R.scene;
  window.__sunLight = null;
  R.scene.traverse((o) => {
    if (o.isDirectionalLight && o.castShadow && o.shadow && o.shadow.mapSize.x >= 2048) window.__sunLight = o;
  });
  window.__lightBase = (o) => {
    if (o.__wrote === undefined || o.__wrote !== o.intensity) o.__base = o.intensity;
    return o.__base;
  };
  window.__setLight = (o, v) => { o.intensity = v; o.__wrote = v; };
  window.__envScale = (k) => {
    const s = R.scene;
    if (s.__envWrote === undefined || s.__envWrote !== s.environmentIntensity) s.__envBase = s.environmentIntensity;
    s.environmentIntensity = s.__envBase * k;
    s.__envWrote = s.environmentIntensity;
  };
  window.__shadowMap = (on) => {
    if (R.three.shadowMap.enabled === !!on) return;
    R.three.shadowMap.enabled = !!on;
    R.scene.traverse((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) if (m) m.needsUpdate = true;
    });
  };
  /**
   * THE SAME ABLATION WITHOUT THE SHADER RECOMPILE. `renderer.shadowMap.enabled = false` is
   * compiled into every program, so §3-D2's form costs a full-scene recompile per arm — measured
   * on this box at roughly five minutes per hour of a sweep under SwiftShader, which is what
   * killed the first attempt at this diagnosis. three r180 (`game/vendor/three/three.core.js`
   * REVISION = '180') carries `LightShadow.intensity`, which is a UNIFORM: the shader computes
   * `shadowValue = 1 - intensity * (1 - shadowValue)`, so 0 means "fully lit" without touching
   * the program. NOT ASSUMED EQUIVALENT — `--equiv` measures both forms at one pose and the run
   * refuses to use this one unless they agree.
   */
  window.__shadowIntensity = (v) => {
    const s = window.__sunLight;
    if (s && s.shadow) s.shadow.intensity = v;
  };
  window.__cfgFn = () => {};
  const prev = R.scene.onBeforeRender ? R.scene.onBeforeRender.bind(R.scene) : null;
  R.scene.onBeforeRender = function (...a) {
    if (prev) prev(...a);
    try { window.__cfgFn(); } catch (e) { window.__cfgError = String((e && e.message) || e); }
  };
  const saved = [];
  R.scene.traverse((o) => { if (o.isLight) saved.push([o, o.intensity, o.visible]); });
  window.__saved = { lights: saved, shadowMap: R.three.shadowMap.enabled, envI: R.scene.environmentIntensity };
  window.__restore = () => {
    window.__cfgFn = () => {}; window.__cfgError = null;
    R.scene.traverse((o) => { if (o.isLight) { delete o.__wrote; delete o.__base; } });
    delete R.scene.__envWrote; delete R.scene.__envBase;
    for (const [o, i, v] of window.__saved.lights) { o.intensity = i; o.visible = v; }
    window.__shadowIntensity(1);
    window.__shadowMap(window.__saved.shadowMap);
    R.scene.environmentIntensity = window.__saved.envI;
  };
  /** Everything about the key and the fit that a cast shadow depends on, off the LIVE scene. */
  window.__readback = () => {
    const sun = window.__sunLight;
    let hemi = 0, amb = 0, moon = null, moonShadow = null;
    let hemiCol = null, ambCol = null, sunCol = null, moonCol = null;
    R.scene.traverse((o) => {
      if (o.isHemisphereLight) { hemi += o.intensity; hemiCol = o.color.toArray().map((v) => +v.toFixed(4)); }
      else if (o.isAmbientLight) { amb += o.intensity; ambCol = o.color.toArray().map((v) => +v.toFixed(4)); }
      else if (o.isDirectionalLight && o.parent === R.scene && o !== sun) { moon = +o.intensity.toFixed(5); moonCol = o.color.toArray().map((v) => +v.toFixed(4)); moonShadow = !!o.castShadow; }
    });
    if (sun) sunCol = sun.color.toArray().map((v) => +v.toFixed(4));
    const sh = sun ? sun.shadow : null;
    const dir = sun ? (() => { const p = sun.position, t = sun.target.position; const d = [p.x - t.x, p.y - t.y, p.z - t.z]; const L = Math.hypot(...d); return d.map((v) => +(v / L).toFixed(4)); })() : null;
    return {
      shadowMapEnabled: R.three.shadowMap.enabled,
      sunIntensity: sun ? +sun.intensity.toFixed(5) : null, sunColour: sunCol, sunCastShadow: sun ? !!sun.castShadow : null,
      sunDirUnit: dir, sunElevationDeg: dir ? +(Math.asin(dir[1]) * 180 / Math.PI).toFixed(3) : null,
      moonIntensity: moon, moonColour: moonCol, moonCastShadow: moonShadow,
      hemiTotal: +hemi.toFixed(4), hemiColour: hemiCol, ambientTotal: +amb.toFixed(4), ambientColour: ambCol,
      hasEnvironment: !!R.scene.environment, environmentIntensity: +Number(R.scene.environmentIntensity).toFixed(5),
      shadowMapSize: sh ? sh.mapSize.x : null,
      shadowCamera: sh ? { left: +sh.camera.left.toFixed(3), right: +sh.camera.right.toFixed(3), near: +sh.camera.near.toFixed(3), far: +sh.camera.far.toFixed(3) } : null,
      shadowBias: sh ? +sh.bias.toExponential(4) : null, shadowNormalBias: sh ? +sh.normalBias.toFixed(5) : null,
      cfgError: window.__cfgError || null,
    };
  };
  return { sun: !!window.__sunLight, mapSize: window.__sunLight ? window.__sunLight.shadow.mapSize.x : null };
});
if (!setupOk.sun) { console.error('FATAL: cannot identify the sun light — every arm would be a silent no-op'); process.exit(3); }
console.log(`arm=${ARM} entry=${ENTRY} sun found, shadowMap=${setupOk.mapSize}, renderer=${attestation.class}`);

const CONFIGS = {
  base:        '() => {}',
  shadows_off: '() => { window.__shadowMap(false); }',
  shadows_off_u: '() => { window.__shadowIntensity(0); }',
  key_off:     '() => { const s = window.__scene(); s.traverse((o) => { if (o.isDirectionalLight && o.parent === s) window.__setLight(o, 0); }); }',
  env_off:     '() => { window.__envScale(0); }',
  // THE TWO ARMS NOBODY HAS EVER RUN. S60 clause (a) compares the KEY against the PROBE and puts
  // the hemisphere and the ambient fill in NEITHER arm, so the frame's fourth and fifth lights
  // have never been ablated by anything in this project. Without them "which term carries the
  // shadow side" is an argument, and choosing a lever from an argument is how round 1 got here.
  hemi_off:    '() => { const s = window.__scene(); s.traverse((o) => { if (o.isHemisphereLight) window.__setLight(o, 0); }); }',
  fill_off:    '() => { const s = window.__scene(); s.traverse((o) => { if (o.isAmbientLight) window.__setLight(o, 0); }); }',
};

/**
 * `--mode screen`: CHOOSE THE NUMBERS BY MEASURING THEM, not by arguing from the arithmetic.
 *
 * Each candidate is a per-frame page-side rig — `sky.apply()` rewrites the lights every frame, so a
 * one-shot edit is gone before the screenshot. It is a SCREENING arm and it is honest about its one
 * blind spot: `sky.js`'s `bakeEnvironmentProbe()` consumes the SUN COLOUR, so warming the key
 * page-side does not warm the probe's sun lobe. The hemisphere and the fill are not in the probe at
 * all, so the ambient half is exact. Whatever this picks is re-measured IN SOURCE afterwards.
 *
 * `warm` lerps the key toward a warm-sunlight ratio at CONSTANT LUMINANCE, and `cool` lerps the
 * hemisphere and the ambient fill toward a skylight ratio at CONSTANT LUMINANCE. Preserving
 * luminance is the S59 guard built into the lever itself: neither can buy hue with brightness.
 */
const MIX = `
  const LUM = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const mixTo = (c, t, k) => {
    if (k <= 0) return;
    const L = LUM(c.r, c.g, c.b), tl = LUM(t[0], t[1], t[2]);
    const s = tl > 1e-6 ? L / tl : 1;
    c.setRGB(c.r * (1 - k) + t[0] * s * k, c.g * (1 - k) + t[1] * s * k, c.b * (1 - k) + t[2] * s * k);
  };
  const WARM = [1.000, 0.855, 0.660];   // ~4800 K sunlight
  const COOL = [0.148, 0.393, 0.798];   // the day zenith's own ratio, normalised
  // MEASURED, NOT GUESSED: the first candidate battery moved hue_offset by 0.18 deg on the sealed
  // pair01 crop (7.16 -> 7.34) at cool = 0.40, because CONSTANT LUMINANCE pulls a lerp back
  // toward where it started when the start is already near the target's luminance. The night
  // recipe reaches 22-33 deg with a key of [0.549, 0.663, 0.847] — a hardcoded cool moon — so the
  // MAGNITUDE of tint that works on this scene's olive albedo is known, and these two targets are
  // that magnitude, applied without the luminance normaliser fighting them.
  const WARM_HARD = [1.000, 0.760, 0.480];
  const COOL_HARD = [0.480, 0.680, 1.000];
  const mixRaw = (c, t, k) => { if (k <= 0) return; c.setRGB(c.r * (1 - k) + t[0] * k, c.g * (1 - k) + t[1] * k, c.b * (1 - k) + t[2] * k); };
`;
function candidateCfg({ warm = 0, cool = 0, skyMul = 1, fillMul = 1, envMul = 1, hard = false }) {
  const W = hard ? 'WARM_HARD' : 'WARM', C = hard ? 'COOL_HARD' : 'COOL', M = hard ? 'mixRaw' : 'mixTo';
  return `() => {
    ${MIX}
    const s = window.__scene();
    s.traverse((o) => {
      if (o.isDirectionalLight && o.parent === s && o === window.__sunLight) ${M}(o.color, ${W}, ${warm});
      else if (o.isHemisphereLight) { ${M}(o.color, ${C}, ${cool}); if (${skyMul} !== 1) window.__setLight(o, window.__lightBase(o) * ${skyMul}); }
      else if (o.isAmbientLight) { ${M}(o.color, ${C}, ${cool}); if (${fillMul} !== 1) window.__setLight(o, window.__lightBase(o) * ${fillMul}); }
    });
    if (${envMul} !== 1) window.__envScale(${envMul});
  }`;
}

const call = async (m, ...a) => {
  const res = await g.page.evaluate(async ({ method, callArgs }) => {
    const H = window.__HARNESS;
    if (typeof H[method] !== 'function') return { __err: `${method} IS NOT A HARNESS VERB` };
    try { return { __ok: await H[method](...callArgs) }; } catch (e) { return { __err: `${method}() threw: ${(e && e.message) || e}` }; }
  }, { method: m, callArgs: a });
  if (res && res.__err) { if (/IS NOT A HARNESS VERB/.test(res.__err)) throw new Error(res.__err); return { ok: false, e: String(res.__err).slice(0, 200) }; }
  return { ok: true, v: res ? res.__ok : undefined };
};

async function subjectPos(subject) {
  const s = await call('snapshot');
  if (!s.ok) throw new Error(`snapshot failed: ${s.e}`);
  let [px, py, pz] = s.v.player.pos;
  if (subject === 'npc') {
    const ents = await call('listEntities');
    const npcs = (ents.ok ? ents.v : []).filter((e) => e.kind === 'npc' || e.kind === 'NPC');
    if (!npcs.length) throw new Error('no NPC in range');
    npcs.sort((a, b) => Math.hypot(a.pos[0] - px, a.pos[2] - pz) - Math.hypot(b.pos[0] - px, b.pos[2] - pz));
    [px, py, pz] = npcs[0].pos;
  }
  return [px, py, pz];
}

async function poseAt([px, py, pz], { yaw_deg, pitch_deg, distance_m, lookHeight = 1.1 }) {
  const yaw = (yaw_deg || 0) * Math.PI / 180, pitch = (pitch_deg || 0) * Math.PI / 180;
  const d = distance_m || 0;
  const eye = [px + Math.sin(yaw) * Math.cos(pitch) * d, py + 1.5 - Math.sin(pitch) * d, pz + Math.cos(yaw) * Math.cos(pitch) * d];
  const r = await call('camera', { pos: eye, look: [px, py + lookHeight, pz] });
  if (!r.ok) throw new Error(`camera pose refused: ${r.e}`);
}

function rawOf(png) {
  return execFileSync('ffmpeg', ['-loglevel', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
}
const lumaAt = (b, i) => 0.2126 * b[i * 3] + 0.7152 * b[i * 3 + 1] + 0.0722 * b[i * 3 + 2];

/**
 * `RI-VIS04` §3-D2's mask: a pixel is CAST-SHADOWED when switching the shadow map off makes it
 * brighter by more than `tau`. Reported as a curve, never at one chosen tau.
 */
function shadowAreaCurve(basePng, shadowsOffPng) {
  const a = rawOf(basePng), b = rawOf(shadowsOffPng);
  const n = Math.min(a.length, b.length) / 3;
  const taus = [1, 2, 4, 8, 16];
  const counts = taus.map(() => 0);
  let sumBrighten = 0;
  for (let i = 0; i < n; i++) {
    const d = lumaAt(b, i) - lumaAt(a, i);
    if (d > 0) sumBrighten += d;
    for (let t = 0; t < taus.length; t++) if (d > taus[t]) counts[t]++;
  }
  const out = {};
  taus.forEach((t, i) => { out[`tau${t}`] = +(counts[i] / n).toFixed(5); });
  out.mean_brighten_when_shadowmap_off = +(sumBrighten / n).toFixed(4);
  return out;
}

/** S60 clause (a): key_off vs env_off mean|d|rgb, restricted to the LIT subset (S60's domain). */
function s60Ratio(basePng, shadowsOffPng, keyOffPng, envOffPng, tau = 8) {
  const base = rawOf(basePng), soff = rawOf(shadowsOffPng), koff = rawOf(keyOffPng), eoff = rawOf(envOffPng);
  const n = Math.min(base.length, soff.length, koff.length, eoff.length) / 3;
  let litN = 0, litKey = 0, litEnv = 0, fullKey = 0, fullEnv = 0;
  for (let i = 0; i < n; i++) {
    const dk = (Math.abs(base[i * 3] - koff[i * 3]) + Math.abs(base[i * 3 + 1] - koff[i * 3 + 1]) + Math.abs(base[i * 3 + 2] - koff[i * 3 + 2])) / 3;
    const de = (Math.abs(base[i * 3] - eoff[i * 3]) + Math.abs(base[i * 3 + 1] - eoff[i * 3 + 1]) + Math.abs(base[i * 3 + 2] - eoff[i * 3 + 2])) / 3;
    fullKey += dk; fullEnv += de;
    if (lumaAt(soff, i) - lumaAt(base, i) <= tau) { litN++; litKey += dk; litEnv += de; }
  }
  const r = (a, b) => (b > 1e-9 ? +(a / b).toFixed(4) : null);
  return {
    lit_fraction: +(litN / n).toFixed(4),
    lit_key: +(litKey / Math.max(1, litN)).toFixed(4), lit_env: +(litEnv / Math.max(1, litN)).toFixed(4),
    lit_ratio: r(litKey / Math.max(1, litN), litEnv / Math.max(1, litN)),
    full_key: +(fullKey / n).toFixed(4), full_env: +(fullEnv / n).toFixed(4),
    full_ratio: r(fullKey / n, fullEnv / n),
  };
}

async function capture(file, cfgName) {
  await g.page.evaluate(() => window.__restore());
  await g.page.evaluate(`window.__cfgFn = (${CONFIGS[cfgName] || cfgName});`);
  await call('stepFrames', 3);
  const readback = await g.page.evaluate(() => window.__readback());
  const shot = await call('screenshot');
  if (!shot.ok) return { error: shot.e, readback };
  const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(file, buf);
  const liveness = gateBuffer(buf, { label: path.basename(file), subject: false, throwOnDegenerate: false });
  return { file: path.relative(REPO, file), abs: file, sha: crypto.createHash('sha256').update(buf).digest('hex'), readback, liveness: liveness.verdict };
}

const manifest = {
  at: new Date().toISOString(), mode: MODE, arm: ARM, entry: ENTRY,
  served: servedSources(ENTRY),
  renderer: attestation, resolution: [CW, CH], seed: SEED,
  evidence_class: attestation && attestation.class === 'HARDWARE' ? 'HARDWARE' : 'SOFTWARE — differential only (HAZARDS §15)',
  rows: [], aborted: null,
};
const reportPath = path.join(OUT, `${MODE}.json`);

try {
  const setup = DECK.setups.find((s) => s.id === String(args.setup || 'char-player'));

  if (MODE === 'budget') {
    // WHICH LIGHT CARRIES WHICH PART OF THE FRAME. Five arms at one judged window, each ablating
    // exactly one term, reported on the SEALED JUDGED CROP and the full frame (S64: the crop is
    // the domain, the frame is always reported alongside). `base_recheck` last, so the run carries
    // its own noise floor and a delta smaller than it is reported as unresolved rather than real.
    const WIN = { pair01: { setup: 'char-player', hour: 8, crop: [300, 150, 512, 512] }, pair03: { setup: 'char-npc', hour: 13, crop: [1100, 150, 512, 512] } };
    for (const wid of String(args.windows || 'pair01').split(',')) {
      const w = WIN[wid];
      const st = DECK.setups.find((s) => s.id === w.setup);
      await call('teleport', st.place.x, st.place.z);
      await call('stepFrames', 4);
      await call('setWeather', 'clear');
      await call('setTimeOfDay', w.hour);
      const sp = await subjectPos(st.camera.subject);
      await poseAt(sp, st.camera);
      await call('stepFrames', SETTLE);
      const dir = path.join(OUT, wid); fs.mkdirSync(dir, { recursive: true });
      const shots = {};
      for (const c of ['base', 'key_off', 'env_off', 'hemi_off', 'fill_off', 'shadows_off_u', 'base_recheck']) {
        shots[c] = await capture(path.join(dir, `${c}.png`), c === 'base_recheck' ? 'base' : c);
      }
      const dl = (a, b) => { const A = rawOf(a), B = rawOf(b); const n = Math.min(A.length, B.length) / 3; let s = 0; for (let i = 0; i < n; i++) s += (Math.abs(A[i * 3] - B[i * 3]) + Math.abs(A[i * 3 + 1] - B[i * 3 + 1]) + Math.abs(A[i * 3 + 2] - B[i * 3 + 2])) / 3; return +(s / n).toFixed(4); };
      const row = { mode: MODE, window: wid, hour: w.hour, crop: w.crop, readback: shots.base.readback, full: {}, noise_floor_full: dl(shots.base.abs, shots.base_recheck.abs) };
      for (const c of ['key_off', 'env_off', 'hemi_off', 'fill_off', 'shadows_off_u']) row.full[c] = dl(shots.base.abs, shots[c].abs);
      row.files = Object.fromEntries(Object.entries(shots).map(([k, v]) => [k, v.file]));
      manifest.rows.push(row);
      console.log(`  ${wid} FULL FRAME mean|d|rgb   ${Object.entries(row.full).map(([k, v]) => `${k}=${v}`).join('  ')}   [noise floor ${row.noise_floor_full}]`);
    }
  }

  if (MODE === 'equiv') {
    // ONE POSE, BOTH ABLATION FORMS. §3-D2 names `renderer.shadowMap.enabled = false`; this run
    // is the licence to use the uniform form instead of it, and it is required to fail if the two
    // disagree. Reported as the full tau curve, not at one tau, and as the SHA of each frame.
    await call('teleport', setup.place.x, setup.place.z);
    await call('stepFrames', 4);
    await call('setWeather', 'clear');
    const sp = await subjectPos('player');
    for (const hour of String(args.hours || '8,13').split(',').map(Number)) {
      await call('setTimeOfDay', hour);
      await poseAt(sp, { yaw_deg: Number(args.yaw || 180), pitch_deg: -14, distance_m: 9.0, lookHeight: 1.2 });
      await call('stepFrames', SETTLE);
      const dir = path.join(OUT, `t${hour}`); fs.mkdirSync(dir, { recursive: true });
      const b = await capture(path.join(dir, 'base.png'), 'base');
      const su = await capture(path.join(dir, 'shadows_off_u.png'), 'shadows_off_u');
      const sm = await capture(path.join(dir, 'shadows_off.png'), 'shadows_off');
      const b2 = await capture(path.join(dir, 'base_recheck.png'), 'base');
      const areaU = shadowAreaCurve(b.abs, su.abs);
      const areaM = shadowAreaCurve(b.abs, sm.abs);
      manifest.rows.push({
        mode: MODE, hour, area_uniform: areaU, area_shadowmap: areaM,
        base_sha: b.sha, base_recheck_sha: b2.sha, base_deterministic: b.sha === b2.sha,
        uniform_sha: su.sha, shadowmap_sha: sm.sha, frames_identical: su.sha === sm.sha,
        readback: b.readback,
      });
      console.log(`  t=${hour} uniform tau8=${areaU.tau8} tau1=${areaU.tau1} | shadowMap tau8=${areaM.tau8} tau1=${areaM.tau1} | base deterministic=${b.sha === b2.sha} | arms byte-identical=${su.sha === sm.sha}`);
    }
  }

  if (MODE === 'hoursweep') {
    const hours = String(args.hours || '6,7,8,9,10,11,12,13,14,15,16,17,18').split(',').map(Number);
    const offArm = String(args.off || 'shadows_off_u');
    await call('teleport', setup.place.x, setup.place.z);
    await call('stepFrames', 4);
    await call('setWeather', String(args.weather || 'clear'));
    const sp = await subjectPos('player');
    for (const hour of hours) {
      await call('setTimeOfDay', hour);
      await poseAt(sp, { yaw_deg: Number(args.yaw || 180), pitch_deg: -14, distance_m: 9.0, lookHeight: 1.2 });
      await call('stepFrames', SETTLE);
      const dir = path.join(OUT, `t${hour}`); fs.mkdirSync(dir, { recursive: true });
      const b = await capture(path.join(dir, 'base.png'), 'base');
      const s = await capture(path.join(dir, 'shadows_off.png'), offArm);
      const area = (b.abs && s.abs) ? shadowAreaCurve(b.abs, s.abs) : null;
      manifest.rows.push({ mode: MODE, hour, base: b.file, shadows_off: s.file, readback: b.readback, area, liveness: [b.liveness, s.liveness] });
      console.log(`  t=${String(hour).padEnd(4)} elev=${String(b.readback.sunElevationDeg).padEnd(8)} sun=${String(b.readback.sunIntensity).padEnd(8)} castShadow=${b.readback.sunCastShadow} nbias=${b.readback.shadowNormalBias} cam=${b.readback.shadowCamera ? b.readback.shadowCamera.right : '-'}  area@8=${area ? area.tau8 : '-'}  area@1=${area ? area.tau1 : '-'}`);
    }
  }

  if (MODE === 'weather') {
    const weathers = String(args.weathers || 'clear,overcast,storm').split(',');
    const hours = String(args.hours || '13').split(',').map(Number);
    await call('teleport', setup.place.x, setup.place.z);
    await call('stepFrames', 4);
    const sp = await subjectPos(setup.camera.subject);
    for (const weather of weathers) {
      for (const hour of hours) {
        await call('setWeather', weather);
        await call('setTimeOfDay', hour);
        await poseAt(sp, setup.camera);
        await call('stepFrames', SETTLE);
        const dir = path.join(OUT, `${weather}-t${hour}`); fs.mkdirSync(dir, { recursive: true });
        const shots = {};
        for (const c of ['base', 'shadows_off', 'key_off', 'env_off']) shots[c] = await capture(path.join(dir, `${c}.png`), c);
        const area = shadowAreaCurve(shots.base.abs, shots.shadows_off.abs);
        const s60 = s60Ratio(shots.base.abs, shots.shadows_off.abs, shots.key_off.abs, shots.env_off.abs);
        manifest.rows.push({ mode: MODE, weather, hour, readback: shots.base.readback, files: Object.fromEntries(Object.entries(shots).map(([k, v]) => [k, v.file])), area, s60 });
        console.log(`  ${weather.padEnd(9)} t=${hour} env=${shots.base.readback.environmentIntensity} sun=${shots.base.readback.sunIntensity} area@8=${area.tau8} lit_ratio=${s60.lit_ratio} full_ratio=${s60.full_ratio}`);
      }
    }
  }

  if (MODE === 'screen') {
    // The candidates. `c0` is the CONTROL and it must reproduce the landed build exactly — if it
    // does not, the rig itself is moving the frame and nothing below means anything.
    const SETS = {
      soft: [
        { id: 'c0-control', warm: 0, cool: 0 },
        { id: 'c1-cool40', warm: 0, cool: 0.40 },
        { id: 'c2-warm70', warm: 0.70, cool: 0 },
        { id: 'c3-warm70-cool40', warm: 0.70, cool: 0.40 },
        { id: 'c4-warm70-cool40-amb146', warm: 0.70, cool: 0.40, skyMul: 1.46, fillMul: 1.47 },
        { id: 'c5-warm100-cool60-amb146', warm: 1.00, cool: 0.60, skyMul: 1.46, fillMul: 1.47 },
        { id: 'c6-warm70-cool40-amb146-env157', warm: 0.70, cool: 0.40, skyMul: 1.46, fillMul: 1.47, envMul: 1.57 },
        { id: 'c7-warm100-cool55-amb190', warm: 1.00, cool: 0.55, skyMul: 1.90, fillMul: 1.90 },
      ],
      // The second battery. `d0` REPEATS the control, so this run carries its own replicate of the
      // landed build and a drift between the two batteries is visible rather than assumed.
      hard: [
        { id: 'd0-control', warm: 0, cool: 0 },
        { id: 'd1-coolhard100', hard: true, warm: 0, cool: 1.00 },
        { id: 'd2-warmhard100', hard: true, warm: 1.00, cool: 0 },
        { id: 'd3-both100', hard: true, warm: 1.00, cool: 1.00 },
        { id: 'd4-both100-amb250', hard: true, warm: 1.00, cool: 1.00, skyMul: 2.50, fillMul: 2.50 },
        { id: 'd5-both100-amb250-env50', hard: true, warm: 1.00, cool: 1.00, skyMul: 2.50, fillMul: 2.50, envMul: 0.50 },
        { id: 'd6-both60-amb180', hard: true, warm: 0.60, cool: 0.60, skyMul: 1.80, fillMul: 1.80 },
      ],
    };
    const CANDIDATES = SETS[String(args.set || 'soft')] || SETS.soft;
    const windows = String(args.windows || 'pair01,pair03').split(',');
    const WIN = {
      pair01: { setup: 'char-player', hour: 8 },
      pair03: { setup: 'char-npc', hour: 13 },
      pair04: { setup: 'char-npc', hour: 8 },
      pair05: { setup: 'char-player', hour: 19.5 },
    };
    for (const wid of windows) {
      const w = WIN[wid];
      const st = DECK.setups.find((s) => s.id === w.setup);
      const where = await call('whereAmI');
      if (where.ok && where.v && where.v.interior) await call('exitInterior');
      await call('teleport', st.place.x, st.place.z);
      await call('stepFrames', 4);
      await call('setWeather', 'clear');
      await call('setTimeOfDay', w.hour);
      const sp = await subjectPos(st.camera.subject);
      await poseAt(sp, st.camera);
      await call('stepFrames', SETTLE);
      for (const c of CANDIDATES) {
        const dir = path.join(OUT, wid); fs.mkdirSync(dir, { recursive: true });
        const r = await capture(path.join(dir, `${c.id}.png`), candidateCfg(c));
        manifest.rows.push({ mode: MODE, window: wid, hour: w.hour, candidate: c, ...r });
        console.log(`  ${wid} ${c.id.padEnd(28)} ${r.error ? 'ERROR ' + r.error : `${r.liveness} sun=${r.readback.sunIntensity} sunCol=${JSON.stringify(r.readback.sunColour)} hemi=${r.readback.hemiTotal} hemiCol=${JSON.stringify(r.readback.hemiColour)} env=${r.readback.environmentIntensity}`}`);
      }
    }
  }

  if (MODE === 'angles') {
    const hours = String(args.hours || '8,13').split(',').map(Number);
    const steps = Number(args.steps || 8);
    await call('teleport', setup.place.x, setup.place.z);
    await call('stepFrames', 4);
    await call('setWeather', String(args.weather || 'clear'));
    const sp = await subjectPos('player');
    for (const hour of hours) {
      await call('setTimeOfDay', hour);
      await call('stepFrames', SETTLE);
      for (let i = 0; i < steps; i++) {
        const yaw = (360 / steps) * i;
        await poseAt(sp, { yaw_deg: yaw, pitch_deg: -12, distance_m: 7.0, lookHeight: 1.2 });
        await call('stepFrames', 2);
        const dir = path.join(OUT, `t${hour}-yaw${String(Math.round(yaw)).padStart(3, '0')}`); fs.mkdirSync(dir, { recursive: true });
        const b = await capture(path.join(dir, 'base.png'), 'base');
        const s = await capture(path.join(dir, 'shadows_off.png'), 'shadows_off');
        const area = (b.abs && s.abs) ? shadowAreaCurve(b.abs, s.abs) : null;
        manifest.rows.push({ mode: MODE, hour, yaw_deg: yaw, base: b.file, shadows_off: s.file, readback: b.readback, area });
        console.log(`  t=${hour} yaw=${String(yaw).padEnd(5)} area@8=${area ? area.tau8 : '-'} sunElev=${b.readback.sunElevationDeg}`);
      }
    }
  }
} catch (e) {
  manifest.aborted = String((e && e.stack) || e);
  console.error('ABORTED:', manifest.aborted);
} finally {
  // HAZARDS §18: a run that measured nothing must not overwrite a run that measured something,
  // and must not exit 0. One-sided by construction — this can only ever refuse to destroy data.
  if (!manifest.rows.length && fs.existsSync(reportPath)) {
    fs.writeFileSync(reportPath.replace(/\.json$/, '.EMPTY-RUN-REFUSED.json'), JSON.stringify(manifest, null, 2));
    console.error(`REFUSED to overwrite ${reportPath} with a zero-row run (HAZARDS §18)`);
  } else {
    fs.writeFileSync(reportPath, JSON.stringify(manifest, null, 2));
    console.log(`wrote ${path.relative(REPO, reportPath)} — ${manifest.rows.length} row(s)`);
  }
  await g.close().catch(() => {});
  if (!manifest.rows.length || manifest.aborted) process.exit(4);
}
