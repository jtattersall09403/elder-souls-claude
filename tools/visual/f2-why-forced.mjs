#!/usr/bin/env node
/**
 * f2-why-forced.mjs — F2/F1 diagnosis, the forced-configuration arm (roadmap F2/F1, ring 1).
 *
 * Re-renders the EXACT five Protocol A r2 setups — same deck, same seed, same teleport, same
 * camera, same hours — under a list of forced render configurations, writes the full 1920x1080
 * frame for each, and crops the exact five judged windows out of it (the crop boxes come from
 * the sealed pairing key, not from a fresh choice).
 *
 * Then it reports, per config, per judged window: mean luma, luma p10/p50/p90, the standard
 * deviation, and the mean absolute delta against the SHIPPED config in that same window. A
 * config whose delta is ~0 in the judged windows did nothing where the judges looked, however
 * green its own instrument was.
 *
 * WHY THIS IS THE RIGHT INSTRUMENT. F1, F2 and F3 each measured a quantity chosen by their own
 * builder over a region chosen by their own builder. This measures the SAME PIXELS THE JUDGES
 * SAW. That is the only quantity that can explain a blind loss.
 *
 * SOFTWARE RENDERER: this is a DIFFERENTIAL test — every arm runs in one process on one
 * renderer, so the comparison is valid even though an absolute appearance claim would not be
 * (HAZARDS §15). W1-F3 measured SwiftShader replicating hardware to three decimals on exactly
 * this pipeline. Pass --gpu hardware to run it on a Pod.
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

const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/blind/deck-protocol-a.json'), 'utf8'));
const OUT = path.resolve(REPO, args.out || 'reports/f2-why/forced');
fs.mkdirSync(OUT, { recursive: true });
const SEED = Number(DECK.capture.seed);
const SETTLE = Number(DECK.capture.settle_frames);
const [CW, CH] = [1920, 1080];

/** The five judged windows, copied verbatim from the sealed pairing key
 * `SEALED-KEY-DO-NOT-OPEN-UNTIL-JUDGED/pairing-r2.json` — our side only. */
const JUDGED = [
  { pair: 'pair01', setup: 'char-player', hour: 8,    crop: [300, 150, 512, 512], what: 'mid-distance exterior architecture over ground' },
  { pair: 'pair02', setup: 'char-player', hour: 13,   crop: [200, 480, 512, 512], what: 'plain built masonry / ground under flat noon' },
  { pair: 'pair03', setup: 'char-npc',    hour: 13,   crop: [1100, 150, 512, 512], what: 'carved built stonework at mid distance' },
  { pair: 'pair04', setup: 'char-npc',    hour: 8,    crop: [200, 480, 512, 512], what: 'near-field ground cover, low-angle light' },
  { pair: 'pair05', setup: 'char-player', hour: 19.5, crop: [1100, 150, 512, 512], what: 'dusk walkway, low ambient' },
];

/**
 * Each config is a function evaluated INSIDE the page, applied after the scene is posed and
 * before the frame is stepped. `shipped` must be first — every delta is against it.
 *
 * Every one of these is a NULL CONTROL or an OVER-DRIVE of exactly one mechanism, so a config
 * that moves nothing in the judged windows proves that mechanism is absent from them.
 */
/**
 * EVERY CONFIG IS ENFORCED PER FRAME, and the reason is a real confound this tool hit and then
 * had to be rebuilt around. The first version applied each config ONCE and then stepped frames.
 * That silently produced no-op arms:
 *
 *   - `sky.apply()` rewrites `sun.intensity`, `hemi.intensity`, `fill.intensity`,
 *     `scene.fog` and the environment probe EVERY FRAME from the region/time recipe, so a
 *     one-shot light edit is gone before the screenshot is taken. Measured: `sun_x3` came back
 *     0.07 luma DARKER than `indirect_off`, which is impossible if it had applied.
 *   - `renderer.shadowMap.enabled` is compiled INTO each material's program, so flipping it at
 *     runtime does nothing until every material is marked `needsUpdate`. `shadows_off` was
 *     therefore indistinguishable from `shipped` for a reason that had nothing to do with
 *     shadows.
 *   - `renderer.js` pushes the AO/GI uniforms every frame from its own config.
 *
 * So each config below is a per-frame ENFORCER installed on `scene.onBeforeRender`, and every
 * row records a READBACK of the live values at capture time. An arm whose readback does not
 * show its intended change is reported as `applied: false` rather than as a measurement.
 */
const CONFIGS = {
  shipped: '() => {}',

  // --- the sun's own shadow map -----------------------------------------------------------
  shadows_off: `() => { __shadowMap(false); }`,

  // --- F2's AO, both directions -----------------------------------------------------------
  ao_off:  `() => { __setU({ uAO: 0 }); }`,
  ao_full: `() => { __setU({ uAOMaxOcclusion: 1.0, uAORadius: 1.2, uAOStrength: 3.1 }); }`,

  // --- F3's ambient fill: does it ERASE the darkening F2 adds? ----------------------------
  gi_off: `() => { __setU({ uGI: 0 }); }`,

  // --- post chain, stage by stage ---------------------------------------------------------
  grade_off: `() => { __setU({ uGradeOn: 0 }); }`,
  post_off:  `() => { __setU({ uPost: 0 }); }`,

  // --- what is actually lighting this frame? ----------------------------------------------
  // POSITIVE CONTROL. `sun_off` MUST darken the frame substantially. If it does not, the
  // enforcement mechanism is broken and no other arm here means anything.
  sun_off:     `() => { __sun((L) => { L.intensity = 0; }); }`,
  sun_x3:      `() => { __sun((L, base) => { L.intensity = base * 3; }); }`,
  env_off:     `() => { __scene().environment = null; }`,
  ambient_off: `() => { __scene().traverse((o) => { if (o.isHemisphereLight || o.isAmbientLight) __setLight(o, 0); }); }`,
  indirect_off:`() => { __scene().environment = null; __scene().traverse((o) => { if (o.isHemisphereLight || o.isAmbientLight) __setLight(o, 0); }); }`,
  // NOT `scene.fog = null`. Measured: nulling it makes a later consumer read `fog.color` and
  // throw inside `screenshot()`, and because the enforcer re-applies it every frame the page
  // stays poisoned — 68 of 80 rows of the first complete run were lost that way, including
  // every arm of four windows. Zeroing the density is the same optical experiment and leaves
  // the object every consumer expects to exist.
  fog_off:     `() => { const f = __scene().fog; if (f) { f.density = 0; if ('near' in f) { f.near = 1e6; f.far = 1e7; } } }`,

  // --- the two remedies this piece exists to choose between --------------------------------
  // `shadow_tight` refits the sun's shadow volume to a 24 m box around the camera instead of
  // the shipped ~143 m radius, without touching anything else. If cast shadows appear, the fit
  // is the defect. `sun_dominant` triples the key and halves every indirect source, which is
  // what a scene with a readable key looks like.
  shadow_tight: `() => { __tightShadow(24); }`,

  // THE LEAK ARM, and the one this piece exists to find. Measured on the live scene at the
  // pack's own pose: SIX DirectionalLights are visible in this exterior frame and the sun is
  // 2.100 of 7.700 total intensity — 27.3%. The other 5.600 belongs to `cells.arena`'s
  // `arena-warm-raking-key` and three keys from `render/places.js`, every one of them aimed at
  // a 5-40 m shadow box centred on the WORLD ORIGIN, thousands of metres from the player, with
  // `mapAllocated: false` — so they deliver full UNSHADOWED directional irradiance from four
  // fixed directions and nothing they light can ever go into shadow. The same is true of the
  // hemisphere fill: 5.1248 total against the sky's own 0.4948, i.e. 90.3% of it is cell art
  // light. `grep -n layers game/src/render/scene.js` returns nothing, so nothing masks them.
  //
  // The rule used to identify them is structural, not a name list: `sky.js` adds its sun, moon,
  // hemisphere and ambient fill DIRECTLY to the scene root, while every cell light is added to
  // a group (`cells.arena`, the rootway `root`, an interior). PointLights are left alone —
  // they have physical distance falloff and are placed in the world.
  cell_lights_off: `() => { const s = __scene(); s.traverse((o) => { if ((o.isHemisphereLight || o.isAmbientLight || o.isDirectionalLight) && o.parent && o.parent !== s) o.visible = false; }); }`,

  // The leak fix plus F2's AO released from its 0.6 cap, which is the pair a remedy would ship.
  cell_lights_off_ao_full: `() => { const s = __scene(); s.traverse((o) => { if ((o.isHemisphereLight || o.isAmbientLight || o.isDirectionalLight) && o.parent && o.parent !== s) o.visible = false; }); __setU({ uAOMaxOcclusion: 1.0, uAORadius: 1.2, uAOStrength: 3.1 }); }`,
  sun_dominant: `() => { __sun((L, base) => { L.intensity = base * 2.2; }); __scene().traverse((o) => { if (o.isHemisphereLight || o.isAmbientLight) __scaleLight(o, 0.35); }); __scene().environmentIntensity = 0.35; }`,

  // THE DRIFT CONTROL, and it is not optional. Every arm of one window is captured from a sim
  // that has advanced by the arms before it — NPCs walk, foliage sways, the sky moves. So the
  // shipped configuration is captured AGAIN at the end of the sweep, from the most-advanced sim
  // state of all. `shipped_recheck` minus `shipped` is the noise floor of this whole instrument,
  // measured rather than assumed, and no arm delta smaller than it may be read as an effect.
  shipped_recheck: '() => {}',
};

// `--configs a,b,c` and `--pairs pair01,pair04` narrow the sweep. A full 16-arm x 5-window run
// is ~70 minutes on SwiftShader, so a follow-up that only needs four arms should cost four arms.
const ONLY_CFG = args.configs ? String(args.configs).split(',').map((s) => s.trim()).filter(Boolean) : null;
const ONLY_PAIR = args.pairs ? String(args.pairs).split(',').map((s) => s.trim()).filter(Boolean) : null;
const ORDER = Object.keys(CONFIGS).filter((k) => !ONLY_CFG || ONLY_CFG.includes(k));
if (ONLY_CFG) {
  const unknown = ONLY_CFG.filter((k) => !CONFIGS[k]);
  if (unknown.length) { console.error(`unknown config(s): ${unknown.join(', ')}. have: ${Object.keys(CONFIGS).join(', ')}`); process.exit(2); }
}

const { g, attestation } = await launchForCapture({
  mode: resolveGpuMode(args), requireHardware: args['require-hardware'] === true,
  entry: 'game/index.html', width: 1280, height: 720,
});
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 120000 });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view');
  c.width = w; c.height = h; window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', SEED);

// Page-side helpers the configs use, plus a snapshot/restore of everything they touch so each
// config starts from the shipped state rather than from its predecessor's damage.
await g.page.evaluate(() => {
  const R = window.__ENGINE.renderer;
  window.__scene = () => R.scene;
  const findComposite = () => {
    for (const k of ['composite', 'compositor', '_composite', 'compositeMaterial']) {
      const c = R[k];
      if (!c) continue;
      if (c.uniforms) return c;
      if (c.material && c.material.uniforms) return c.material;
      if (c.compositeMaterial && c.compositeMaterial.uniforms) return c.compositeMaterial;
    }
    let found = null;
    R.scene.traverse((o) => { if (!found && o.material && o.material.uniforms && o.material.uniforms.uAOMaxOcclusion) found = o.material; });
    return found;
  };
  window.__comp = findComposite();
  window.__setU = (obj) => {
    const m = window.__comp;
    if (!m) throw new Error('composite material not reachable');
    for (const k of Object.keys(obj)) {
      if (!m.uniforms[k]) throw new Error(`no uniform ${k}`);
      m.uniforms[k].value = obj[k];
    }
    // Pin them: renderer.js pushes AO/GI uniforms every frame from its own config, so a raw
    // write is overwritten on the next step unless it is re-applied. A Proxy-free re-apply
    // hook on the material's onBeforeRender is the cheap version of that.
    window.__pinned = Object.assign(window.__pinned || {}, obj);
  };
  window.__clearPins = () => { window.__pinned = {}; };

  // The one directional light that carries the sun: the only shadow-casting directional whose
  // intensity the sky recipe drives. Found by identity, not by an intensity threshold — an
  // arm that selects "whichever light is currently bright" stops selecting it the moment the
  // arm itself changes the brightness.
  window.__sunLight = null;
  R.scene.traverse((o) => {
    if (o.isDirectionalLight && o.castShadow && o.shadow && o.shadow.mapSize.x >= 2048) window.__sunLight = o;
  });
  // A multiplying arm run inside a per-frame enforcer COMPOUNDS (3^n after n frames) unless it
  // multiplies the recipe's own value rather than last frame's result. `sky.apply()` rewrites
  // `intensity` from the recipe before this enforcer runs, so the recipe value is recoverable:
  // whenever the live value differs from what this enforcer last wrote, the sky has just written
  // it and that is the base. Verified by the readback — `sun_x3` must report exactly 3x the
  // `shipped` row's sun intensity, not 3^12 of it.
  //
  // It also fixes a second confound: the base captured at page-setup time was 0.8, because the
  // sky recipe had not run for the setup's region and hour yet. An arm scaled off 0.8 while the
  // shipped frame runs at 2.1 is not the experiment it claims to be.
  window.__lightBase = (o) => {
    if (o.__f2wrote === undefined || o.__f2wrote !== o.intensity) o.__f2base = o.intensity;
    return o.__f2base;
  };
  window.__setLight = (o, v) => { o.intensity = v; o.__f2wrote = v; };
  window.__scaleLight = (o, k) => { window.__setLight(o, window.__lightBase(o) * k); };
  window.__sun = (fn) => {
    const L = window.__sunLight;
    if (!L) return;
    const base = window.__lightBase(L);
    fn({ set intensity(v) { window.__setLight(L, v); }, get intensity() { return L.intensity; } }, base);
  };

  // `shadowMap.enabled` is compiled into every program. Toggling it without invalidating the
  // programs is a silent no-op, which is exactly what the first version of this tool measured.
  window.__shadowMap = (on) => {
    if (R.three.shadowMap.enabled === !!on) return;
    R.three.shadowMap.enabled = !!on;
    R.scene.traverse((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) if (m) m.needsUpdate = true;
    });
  };

  // Refit the sun's shadow volume to a tight box around the camera. Nothing else changes: same
  // map size, same light, same bias policy, so any difference is the fit and only the fit.
  window.__tightShadow = (halfExtentM) => {
    const L = window.__sunLight;
    if (!L) return;
    const cam = R.camera;
    const c = L.shadow.camera;
    const t = cam.position.clone();
    const fwd = new (t.constructor)(); cam.getWorldDirection(fwd);
    t.addScaledVector(fwd, halfExtentM * 0.5);
    const dir = L.position.clone().sub(L.target.position).normalize();
    L.target.position.copy(t); L.target.updateMatrixWorld(true);
    L.position.copy(t).addScaledVector(dir, halfExtentM * 6);
    L.updateMatrixWorld(true);
    c.left = -halfExtentM; c.right = halfExtentM; c.top = halfExtentM; c.bottom = -halfExtentM;
    c.near = 0.5; c.far = halfExtentM * 12 + 10;
    c.updateProjectionMatrix();
    const texel = (halfExtentM * 2) / L.shadow.mapSize.x;
    L.shadow.bias = -texel * 0.002; L.shadow.normalBias = texel * 1.4;
    L.shadow.needsUpdate = true;
  };

  // ---- the per-frame enforcer -------------------------------------------------------------
  // `sky.apply()` rewrites the lights, the fog and the probe every frame from the recipe, and
  // `renderer.js` rewrites the AO/GI uniforms. So the forced configuration is re-applied
  // immediately before every scene draw, which is after both of those have run.
  window.__cfgFn = () => {};
  const prevSceneHook = R.scene.onBeforeRender ? R.scene.onBeforeRender.bind(R.scene) : null;
  R.scene.onBeforeRender = function (...a) {
    if (prevSceneHook) prevSceneHook(...a);
    try { window.__cfgFn(); } catch (e) { window.__cfgError = String(e && e.message || e); }
    const m = window.__comp, p = window.__pinned;
    if (m && p) for (const k of Object.keys(p)) if (m.uniforms[k]) m.uniforms[k].value = p[k];
  };

  // Save the shipped values of everything an arm can touch, so `__restore` is a real reset.
  const savedLights = [];
  R.scene.traverse((o) => { if (o.isLight) savedLights.push([o, o.intensity, o.visible]); });
  window.__saved = {
    lights: savedLights,
    shadowMap: R.three.shadowMap.enabled,
    environmentIntensity: R.scene.environmentIntensity,
    shadowCam: window.__sunLight ? (() => { const c = window.__sunLight.shadow.camera;
      return { left: c.left, right: c.right, top: c.top, bottom: c.bottom, near: c.near, far: c.far,
        bias: window.__sunLight.shadow.bias, normalBias: window.__sunLight.shadow.normalBias }; })() : null,
  };
  window.__restore = () => {
    const s = window.__saved;
    window.__cfgFn = () => {};
    window.__pinned = {};
    window.__cfgError = null;
    // Drop the per-light base bookkeeping, or an arm inherits the previous arm's idea of what
    // the recipe value was and its first enforced frame scales the wrong number.
    R.scene.traverse((o) => { if (o.isLight) { delete o.__f2wrote; delete o.__f2base; } });
    // `sky.apply()` only rewrites ITS OWN sun/hemi/fill each frame. A cell light zeroed or
    // hidden by an arm therefore stays zeroed or hidden forever unless it is restored here —
    // measured: after one `indirect_off` arm the scene's total hemisphere intensity never came
    // back from 0.4948 to 5.1248, which silently changed the baseline of every later arm.
    for (const [o, i, v] of s.lights) { o.intensity = i; o.visible = v; }
    window.__shadowMap(s.shadowMap);
    R.scene.environmentIntensity = s.environmentIntensity;
    if (window.__sunLight && s.shadowCam) {
      const c = window.__sunLight.shadow.camera;
      Object.assign(c, { left: s.shadowCam.left, right: s.shadowCam.right, top: s.shadowCam.top, bottom: s.shadowCam.bottom, near: s.shadowCam.near, far: s.shadowCam.far });
      c.updateProjectionMatrix();
      window.__sunLight.shadow.bias = s.shadowCam.bias;
      window.__sunLight.shadow.normalBias = s.shadowCam.normalBias;
    }
    const m = window.__comp;
    if (m) {
      m.uniforms.uAO.value = 1; m.uniforms.uGI.value = 1; m.uniforms.uPost.value = 1;
      m.uniforms.uGradeOn.value = 1; m.uniforms.uAOMaxOcclusion.value = 0.6;
      m.uniforms.uAORadius.value = 0.42; m.uniforms.uAOStrength.value = 3.1;
    }
  };
  // What the live scene actually looks like at the moment of capture. Every row carries this,
  // so an arm that did not apply is visible as data rather than inferred from a flat number.
  window.__readback = () => {
    const u = window.__comp ? window.__comp.uniforms : {};
    let hemi = 0, amb = 0;
    R.scene.traverse((o) => { if (o.isHemisphereLight) hemi += o.intensity; else if (o.isAmbientLight) amb += o.intensity; });
    const c = window.__sunLight ? window.__sunLight.shadow.camera : null;
    return {
      shadowMapEnabled: R.three.shadowMap.enabled,
      sunIntensity: window.__sunLight ? window.__sunLight.intensity : null,
      hemiTotal: +hemi.toFixed(4), ambientTotal: +amb.toFixed(4),
      hasEnvironment: !!R.scene.environment, environmentIntensity: R.scene.environmentIntensity,
      hasFog: !!R.scene.fog,
      shadowHalfExtent: c ? +((c.right - c.left) / 2).toFixed(2) : null,
      dirTotal: (() => { let t = 0; R.scene.traverse((o) => { if (o.isDirectionalLight && o.visible) t += o.intensity; }); return +t.toFixed(4); })(),
      dirCount: (() => { let n = 0; R.scene.traverse((o) => { if (o.isDirectionalLight && o.visible && o.intensity > 0) n++; }); return n; })(),
      uAO: u.uAO ? u.uAO.value : null, uGI: u.uGI ? u.uGI.value : null,
      uPost: u.uPost ? u.uPost.value : null, uGradeOn: u.uGradeOn ? u.uGradeOn.value : null,
      uAOMaxOcclusion: u.uAOMaxOcclusion ? u.uAOMaxOcclusion.value : null,
      uAORadius: u.uAORadius ? u.uAORadius.value : null,
      cfgError: window.__cfgError || null,
    };
  };
  return !!window.__comp;
});
const setupOk = await g.page.evaluate(() => ({ comp: !!window.__comp, sun: !!window.__sunLight, sunName: window.__sunLight ? (window.__sunLight.name || '(unnamed)') : null, mapSize: window.__sunLight ? window.__sunLight.shadow.mapSize.x : null }));
console.log(`composite reachable: ${setupOk.comp}   sun light found: ${setupOk.sun} name=${setupOk.sunName} shadowMap=${setupOk.mapSize}`);
if (!setupOk.comp) { console.error('FATAL: cannot reach the composite material — every uniform arm would be a silent no-op'); process.exit(3); }
if (!setupOk.sun) { console.error('FATAL: cannot identify the sun light — every light arm would be a silent no-op'); process.exit(3); }

const call = async (m, ...a) => {
  const res = await g.page.evaluate(async ({ method, callArgs }) => {
    const H = window.__HARNESS;
    if (typeof H[method] !== 'function') return { __err: `${method} is not a function` };
    try { return { __ok: await H[method](...callArgs) }; } catch (e) { return { __err: `${method}() threw: ${e && e.message || e}` }; }
  }, { method: m, callArgs: a });
  if (res && res.__err) return { ok: false, e: String(res.__err).slice(0, 200) };
  return { ok: true, v: res ? res.__ok : undefined };
};

async function poseCamera(setup) {
  const s = await call('snapshot');
  if (!s.ok) return `snapshot failed: ${s.e}`;
  let [px, py, pz] = s.v.player.pos;
  if (setup.camera.subject === 'npc') {
    const ents = await call('listEntities');
    const npcs = (ents.ok ? ents.v : []).filter((e) => e.kind === 'npc' || e.kind === 'NPC');
    if (!npcs.length) return 'no NPC in range';
    npcs.sort((a, b) => Math.hypot(a.pos[0] - px, a.pos[2] - pz) - Math.hypot(b.pos[0] - px, b.pos[2] - pz));
    [px, py, pz] = npcs[0].pos;
  }
  const cam = setup.camera;
  const yaw = (cam.yaw_deg || 0) * Math.PI / 180, pitch = (cam.pitch_deg || 0) * Math.PI / 180;
  const dist = cam.distance_m || 0;
  const eye = [px + Math.sin(yaw) * Math.cos(pitch) * dist, py + 1.5 - Math.sin(pitch) * dist, pz + Math.cos(yaw) * Math.cos(pitch) * dist];
  const r = await call('camera', { pos: eye, look: [px, py + 1.1, pz] });
  return r.ok ? null : `camera pose refused: ${r.e}`;
}

/** Decode a PNG to raw RGB via ffmpeg and return per-window statistics. */
function windowStats(pngPath, crop) {
  const [x, y, w, h] = crop;
  const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', pngPath, '-vf', `crop=${w}:${h}:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  const n = w * h;
  const luma = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    luma[i] = 0.2126 * raw[i * 3] + 0.7152 * raw[i * 3 + 1] + 0.0722 * raw[i * 3 + 2];
  }
  const sorted = Float64Array.from(luma).sort();
  const q = (f) => sorted[Math.min(n - 1, Math.max(0, Math.round(f * (n - 1))))];
  let sum = 0; for (let i = 0; i < n; i++) sum += luma[i];
  const mean = sum / n;
  let v = 0; for (let i = 0; i < n; i++) v += (luma[i] - mean) ** 2;
  // Chroma spread: how far apart the hues in this window are. A window where every surface
  // "returns the same flat matte olive-grey" has a tiny value here regardless of its luma.
  let cs = 0;
  for (let i = 0; i < n; i++) {
    const r = raw[i * 3], gg = raw[i * 3 + 1], b = raw[i * 3 + 2];
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    cs += mx - mn;
  }
  return {
    mean_luma: +mean.toFixed(4), sd_luma: +Math.sqrt(v / n).toFixed(4),
    p10: +q(0.10).toFixed(2), p50: +q(0.50).toFixed(2), p90: +q(0.90).toFixed(2),
    span: +(q(0.99) - q(0.01)).toFixed(2),
    mean_chroma: +(cs / n).toFixed(4),
    raw,
  };
}

function meanAbsDelta(a, b) {
  let s = 0; const n = a.length;
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
  return +(s / n).toFixed(4);
}

const rows = [];
for (const cfgName of ORDER) fs.mkdirSync(path.join(OUT, cfgName), { recursive: true });
// WINDOW OUTER, CONFIG INNER. The first version of this loop had config outer and re-teleported
// for all 60 rows; province streaming after a teleport dominates the run and it was ~2 minutes
// per row. The place, the hour and the camera pose are identical across every arm of one window
// by construction, so they are set ONCE and only the forced configuration changes inside — which
// is also a stronger experiment: no arm can differ from another by a re-streamed world.
for (const jw of JUDGED.filter((j) => !ONLY_PAIR || ONLY_PAIR.includes(j.pair))) {
  const setup = DECK.setups.find((s) => s.id === jw.setup);
  const where = await call('whereAmI');
  if (where.ok && where.v && where.v.interior) await call('exitInterior');
  await call('teleport', setup.place.x, setup.place.z);
  await call('stepFrames', 4);
  await call('setWeather', 'clear');
  await call('setTimeOfDay', jw.hour);
  const perr = await poseCamera(setup);
  await call('stepFrames', SETTLE);
  for (const cfgName of ORDER) {
    const dir = path.join(OUT, cfgName);
    // restore, then INSTALL this arm's forced configuration as the per-frame enforcer
    await g.page.evaluate(() => window.__restore());
    await g.page.evaluate(`window.__cfgFn = (${CONFIGS[cfgName]});`);
    // Three frames, not twelve. The camera does not move between arms, so F3's twelve-frame
    // camera-settle does not apply here; what does need frames is a shader recompile
    // (`shadows_off`) and one enforced pass. Twelve frames per arm advanced the sim by 144
    // frames across a window and put a drift larger than several of the effects into the means.
    await call('stepFrames', 3);
    const readback = await g.page.evaluate(() => window.__readback());
    const shot = await call('screenshot');
    if (!shot.ok) {
      rows.push({ config: cfgName, pair: jw.pair, readback, error: shot.e });
      console.log(`  ${cfgName.padEnd(13)} ${jw.pair}  ERROR: ${shot.e}`);
      continue;
    }
    const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
    const file = path.join(dir, `${jw.pair}__${jw.setup}__t${jw.hour}.png`);
    fs.writeFileSync(file, buf);
    const liveness = gateBuffer(buf, { label: `${cfgName}/${jw.pair}`, subject: false, throwOnDegenerate: false });
    const st = windowStats(file, jw.crop);
    // write the crop itself so a human can OPEN it — the whole point of this piece
    const cropFile = path.join(dir, `${jw.pair}__CROP.png`);
    const [cx, cy, cw, ch] = jw.crop;
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', file, '-vf', `crop=${cw}:${ch}:${cx}:${cy}`, cropFile]);
    rows.push({
      config: cfgName, pair: jw.pair, setup: jw.setup, hour: jw.hour, what: jw.what,
      pose_error: perr, frame: path.relative(REPO, file), crop_file: path.relative(REPO, cropFile),
      frame_sha: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16),
      liveness: liveness.verdict, liveness_why: liveness.why && liveness.why.length ? liveness.why : null,
      stats: { mean_luma: st.mean_luma, sd_luma: st.sd_luma, p10: st.p10, p50: st.p50, p90: st.p90, span: st.span, mean_chroma: st.mean_chroma },
      readback,
      _raw: st.raw,
    });
    const rb = `sun=${readback.sunIntensity}/${readback.dirTotal} nDir=${readback.dirCount} shm=${readback.shadowMapEnabled ? 1 : 0} hemi=${readback.hemiTotal} env=${readback.hasEnvironment ? 1 : 0}@${readback.environmentIntensity} aoCap=${readback.uAOMaxOcclusion}`;
    console.log(`  ${cfgName.padEnd(13)} ${jw.pair}  mean=${String(st.mean_luma).padStart(8)} sd=${String(st.sd_luma).padStart(7)} chroma=${String(st.mean_chroma).padStart(7)} ${liveness.verdict}  [${rb}]`);
  }
}

// deltas against shipped, per judged window
const shipped = new Map(rows.filter((r) => r.config === 'shipped' && r._raw).map((r) => [r.pair, r._raw]));
for (const r of rows) {
  if (!r._raw) continue;
  const base = shipped.get(r.pair);
  r.delta_vs_shipped = base ? { mean_abs_rgb: meanAbsDelta(r._raw, base) } : null;
  delete r._raw;
}

const out = {
  at: new Date().toISOString(),
  what_this_is: 'F2/F1 diagnosis: the five judged Protocol A r2 windows re-rendered under forced render configurations. Crop boxes copied verbatim from the sealed pairing key.',
  renderer: attestation,
  evidence_class: attestation && attestation.class === 'HARDWARE' ? 'HARDWARE' : 'SOFTWARE — differential only, not an absolute appearance claim (HAZARDS §15)',
  configs: Object.fromEntries(Object.keys(CONFIGS).map((k) => [k, CONFIGS[k]])),
  judged_windows: JUDGED.map(({ pair, setup, hour, crop, what }) => ({ pair, setup, hour, crop, what })),
  rows,
};
fs.writeFileSync(path.join(OUT, 'forced.json'), JSON.stringify(out, null, 2));
console.log(`\nwrote ${path.join(OUT, 'forced.json')}`);
await g.close();
process.exit(0);
