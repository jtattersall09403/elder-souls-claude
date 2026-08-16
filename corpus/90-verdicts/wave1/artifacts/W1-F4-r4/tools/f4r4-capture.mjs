/**
 * F4 ROUND-4 BUILDER'S CAPTURE TOOL.
 *
 * MODELLED ON the round-3 builder's `f4r3-capture.mjs` and the round-3 critic's `f4r3c-motion.mjs`,
 * with its own output path (HAZARDS §17 — a reused tool writes into its author's directory by
 * construction, and a filed verdict's artefacts are immutable).
 *
 * WHAT THIS ROUND IS FOR, AND IT IS NOT HUE. `RI-VIS03` M6 carries an UNCONDITIONAL hard fail —
 * *"`retention < 0.30` -> crushed blacks / no ambient / no IBL"* — and the shipped build reads
 * **0.2324** at pair03's sealed judged crop. It has read that since round 1 (the round-1 builder's
 * own banked crop is 0.2321) and no F4 verdict has ever recorded it. `SCORING.md` §1.1 caps the
 * item at 2 while it stands, which is why three rounds of colour work could not move the score.
 *
 * MEASURED OFFLINE BEFORE ANY ARM WAS WRITTEN, on round 3's own banked pair03 frames, so the sweep
 * below is aimed rather than guessed (S63: do not narrate a mechanism you have not ablated):
 *
 *   pair03 sealed crop, darkest quartile, mean Yp x 255
 *     base 10.43 · key_off 10.43 · env_off 1.75 · shadows_off 58.15
 *     -> the KEY owns 0.04% of that quartile's brightness, the ENVIRONMENT PROBE owns 83.2%,
 *        and the hemisphere + ambient fill together own 16.8%, which is 1.75 of 255.
 *
 * So the two candidate levers are the probe (`scene.environmentIntensity`, recipe `env`) and the
 * hemisphere/fill pair (recipe `sky`/`fill`), and they are NOT equivalent under the acceptance:
 * `S60` clause (a) compares `key_off` against `env_off` on the lit subset, so raising `env` moves
 * one arm of the acceptance and raising `sky`/`fill` moves NEITHER (`RI-VIS04` §2-D2 step 1's own
 * finding: 0.558 of ambient intensity sits in no arm of the acceptance). `--mode ambient` measures
 * both, at several multiples, before a single number is changed in source.
 *
 * MODES
 *   ambient   the sweep above. Base frames only — `retention`, `C_shadow` and `mean_Yp_shadow` are
 *             unconditional statistics of the darkest quartile and need no ablation arm.
 *   windows   the five judged windows with the arms `S60` and `RI-VIS04` §2-D3 both require, all
 *             captured IN THE SAME PROCESS: base, shadows_off, key_off, env_off, base_recheck
 *             (last, so the window carries its own S61 floor).
 *   weather   the same, at a named weather state. `overcast` has one sample in this project's
 *             history and `storm` has never been photographed by anyone.
 *   orbit     many angles around the player. The owner's directive: stills are not enough.
 *   walk      a driven walk through the shipped input pipeline, displacement measured per frame
 *             (HAZARDS §16), so a dead input path shows up as data rather than as a still picture.
 *   shadowfit shadow-rig readback at several angles: cascade count, per-cascade map size, the
 *             fitted texel, `shadow.camera.far`. `RI-VIS04` §3's MIN BAR is a configuration claim
 *             and it is read off the live scene, not off the source.
 *
 * EVERY ARM IS PAGE-SIDE AND PER-FRAME (`scene.onBeforeRender`), because `sky.apply()` rewrites
 * every light every frame. HAZARDS §24: `shadow.intensity` is a UNIFORM and survives a light
 * restore, so `__restore()` puts it back explicitly.
 *
 * DECLARED LIMIT OF THE SWEEP: a page-side multiplier on `hemi.intensity` reaches the hemisphere
 * light and NOT the environment probe's bake, which `sky.js` builds from the sky's own colours. A
 * source change to recipe `sky`/`fill` is the same thing (those multipliers do not enter
 * `environmentProbeSpec`), so the sweep is faithful for `sky`/`fill`. For `env` the page-side arm
 * scales `scene.environmentIntensity`, which IS exactly what recipe `env` sets. Both are checked
 * against a source build afterwards rather than assumed.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchForCapture, resolveGpuMode } from '../../../../../../tools/visual/lib/gpu-launch.mjs';
import { gateBuffer } from '../../../../../../tools/visual/frame-liveness.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const MODE = String(args.mode || 'ambient');
const ENTRY = String(args.entry || 'game/index.html');
const TAG = String(args.tag || MODE);
const OUT = path.resolve(REPO, args.out || `reports/f4r4/${TAG}`);
fs.mkdirSync(OUT, { recursive: true });
const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/blind/deck-protocol-a.json'), 'utf8'));
const SEED = Number(DECK.capture.seed);
const SETTLE = Number(DECK.capture.settle_frames);
const [CW, CH] = String(args.res || '1920x1080').split('x').map(Number);

/** The five judged windows, verbatim from `tools/visual/f4c-critic.mjs` and round 3's tool. */
const WINDOWS = [
  { pair: 'pair01', setup: 'char-player', hour: 8, crop: [300, 150, 512, 512] },
  { pair: 'pair02', setup: 'char-player', hour: 13, crop: [200, 480, 512, 512] },
  { pair: 'pair03', setup: 'char-npc', hour: 13, crop: [1100, 150, 512, 512] },
  { pair: 'pair04', setup: 'char-npc', hour: 8, crop: [200, 480, 512, 512] },
  { pair: 'pair05', setup: 'char-player', hour: 19.5, crop: [1100, 150, 512, 512] },
];

/** HAZARDS §22: which lighting source this arm actually SERVED, recorded rather than assumed. */
function servedSources(entry) {
  const gameDir = path.dirname(path.resolve(entry));
  const out = {};
  for (const rel of ['src/render/lib/lighting-recipes.js', 'src/render/sky.js']) {
    const p = path.join(gameDir, rel);
    out[rel] = fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16) : null;
  }
  return out;
}

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

const setupOk = await g.page.evaluate(async () => {
  const R = window.__ENGINE.renderer;
  window.__scene = () => R.scene;
  window.__sky = R.sky || null;
  // The sun is the brightest shadow-casting directional light parented to the scene. Round 3's
  // tool keyed on `mapSize >= 2048`, which is true of every cascade once cascades exist; keeping
  // "brightest" makes the identification survive the cascade change rather than silently pick one.
  window.__sunLight = null;
  window.__cascades = [];
  R.scene.traverse((o) => {
    if (!o.isDirectionalLight || o.parent !== R.scene) return;
    if (o.castShadow) window.__cascades.push(o);
    if (o.castShadow && (!window.__sunLight || o.intensity > window.__sunLight.intensity)) window.__sunLight = o;
  });
  if (!window.__sunLight && window.__sky && window.__sky.sun) window.__sunLight = window.__sky.sun;
  window.__envScale = (k) => {
    const s = R.scene;
    if (s.__envWrote === undefined || s.__envWrote !== s.environmentIntensity) s.__envBase = s.environmentIntensity;
    s.environmentIntensity = s.__envBase * k;
    s.__envWrote = s.environmentIntensity;
  };
  /** Scale every hemisphere light parented to the scene, from whatever `apply()` just wrote. */
  window.__hemiScale = (k) => { R.scene.traverse((o) => { if (o.isHemisphereLight && o.parent === R.scene) o.intensity *= k; }); };
  window.__fillScale = (k) => { R.scene.traverse((o) => { if (o.isAmbientLight && o.parent === R.scene) o.intensity *= k; }); };
  window.__lightCensus = () => {
    const rows = [];
    R.scene.traverse((o) => {
      if (!o.isLight) return;
      const chain = []; let p = o, visible = true;
      while (p) { chain.push(p.name || p.type); if (p.visible === false) visible = false; p = p.parent; }
      rows.push({
        name: o.name || '(unnamed)', type: o.type, intensity: +Number(o.intensity).toFixed(5),
        colour: o.color ? o.color.toArray().map((v) => +v.toFixed(4)) : null,
        castShadow: !!o.castShadow,
        mapSize: o.shadow ? o.shadow.mapSize.x : null,
        self_visible: o.visible !== false, chain_visible: visible, parent_chain: chain.slice(1).join(' < '),
      });
    });
    return rows;
  };
  /**
   * `RI-VIS04` §3 MIN BAR read off the LIVE scene: cascade count, per-cascade map, distance.
   *
   * CORRECTED IN FLIGHT, AGAINST MYSELF. The first version of this function counted every
   * shadow-casting directional light in the graph and reported `cascade_count: 5`. Four of those
   * five are 1024-map lights inside HIDDEN groups (`arena-warm-raking-key` and three unnamed at
   * intensity 1.35) — they cannot reach a pixel. That is precisely the error `RI-VIS04` §2-D2
   * step 1 was written about, where a scene-wide hemisphere sum was wrong by 13x, and I made it
   * in my own instrument while reading the item that names it. `chain_visible` now decides, and
   * both counts are published so the correction is legible rather than silent.
   *
   * `three.shadowMap.type` lives on the THREE.WebGLRenderer, which is `R.three` on this build's
   * wrapper, not `R.renderer` — the first version read `null` and could not verify the MIN BAR's
   * PCF clause at all.
   */
  window.__shadowRig = () => {
    const casters = [], hidden = [];
    const chainVisible = (o) => { let p = o; while (p) { if (p.visible === false) return false; p = p.parent; } return true; };
    R.scene.traverse((o) => {
      if (o.isDirectionalLight && o.castShadow && o.shadow) {
        const c = o.shadow.camera;
        const row = {
          name: o.name || '(unnamed)', mapSize: o.shadow.mapSize.x, chain_visible: chainVisible(o),
          intensity: +Number(o.intensity).toFixed(5),
          shadowIntensity: o.shadow.intensity,
          bias: o.shadow.bias, normalBias: o.shadow.normalBias, radius: o.shadow.radius,
          camera: { near: +c.near.toFixed(3), far: +c.far.toFixed(3), left: +c.left.toFixed(3), right: +c.right.toFixed(3) },
          extent_m: +(c.right - c.left).toFixed(3),
          texel_m: +((c.right - c.left) / o.shadow.mapSize.x).toFixed(5),
        };
        (row.chain_visible ? casters : hidden).push(row);
      }
    });
    const sky = window.__sky;
    const three = R.three || R.renderer || null;
    return {
      // The number `RI-VIS04` §3's MIN BAR is about: shadow casters that can reach a pixel.
      cascade_count: casters.length, casters,
      cascade_count_scene_wide_DO_NOT_QUOTE: casters.length + hidden.length,
      hidden_casters: hidden,
      shadowMapType: three ? three.shadowMap.type : null,
      shadowMapTypeName: three ? ({ 0: 'BasicShadowMap', 1: 'PCFShadowMap', 2: 'PCFSoftShadowMap', 3: 'VSMShadowMap' }[three.shadowMap.type] || String(three.shadowMap.type)) : null,
      shadowMapEnabled: three ? three.shadowMap.enabled : null,
      shadowDistance_m: sky ? sky.shadowDistance : null,
      splits_m: sky && sky.cascadeSplits ? sky.cascadeSplits : null,
      lastFit: sky && sky._lastFit ? sky._lastFit : null,
      moonCastShadow: sky && sky.moon ? !!sky.moon.castShadow : null,
    };
  };
  window.__cfgFn = () => {};
  const prev = R.scene.onBeforeRender ? R.scene.onBeforeRender.bind(R.scene) : null;
  R.scene.onBeforeRender = function (...a) {
    if (prev) prev(...a);
    try { window.__cfgFn(); } catch (e) { window.__cfgError = String((e && e.message) || e); }
  };
  const saved = [];
  R.scene.traverse((o) => { if (o.isLight) saved.push([o, o.intensity, o.visible, o.color ? o.color.clone() : null]); });
  window.__saved = { lights: saved, envI: R.scene.environmentIntensity };
  window.__restore = () => {
    window.__cfgFn = () => {}; window.__cfgError = null;
    for (const [o, i, v, c] of window.__saved.lights) { o.intensity = i; o.visible = v; if (c && o.color) o.color.copy(c); }
    // HAZARDS §24: shadow.intensity is a UNIFORM and survives a light restore.
    for (const o of window.__cascades) if (o.shadow) o.shadow.intensity = 1;
    if (window.__sunLight && window.__sunLight.shadow) window.__sunLight.shadow.intensity = 1;
    delete R.scene.__envWrote; delete R.scene.__envBase;
    R.scene.environmentIntensity = window.__saved.envI;
  };
  window.__readback = () => {
    const sun = window.__sunLight, sky = window.__sky;
    let hemiVis = 0, ambVis = 0, hemiAll = 0, ambAll = 0, hemiCol = null, ambCol = null;
    R.scene.traverse((o) => {
      const chainVisible = (() => { let p = o; while (p) { if (p.visible === false) return false; p = p.parent; } return true; })();
      if (o.isHemisphereLight) { hemiAll += o.intensity; if (chainVisible) hemiVis += o.intensity; if (o.parent === R.scene) hemiCol = o.color.toArray().map((v) => +v.toFixed(4)); }
      else if (o.isAmbientLight) { ambAll += o.intensity; if (chainVisible) ambVis += o.intensity; if (o.parent === R.scene) ambCol = o.color.toArray().map((v) => +v.toFixed(4)); }
    });
    return {
      sunIntensity: sun ? +sun.intensity.toFixed(5) : null,
      sunColour: sun ? sun.color.toArray().map((v) => +v.toFixed(4)) : null,
      cascadeIntensities: window.__cascades.map((o) => +Number(o.intensity).toFixed(5)),
      moonIntensity: sky && sky.moon ? +sky.moon.intensity.toFixed(5) : null,
      uSunColour: sky ? sky.uniforms.uSunColour.value.toArray().map((v) => +v.toFixed(4)) : null,
      uHorizon: sky ? sky.uniforms.uHorizon.value.toArray().map((v) => +v.toFixed(4)) : null,
      uZenith: sky ? sky.uniforms.uZenith.value.toArray().map((v) => +v.toFixed(4)) : null,
      recipeId: sky && sky.lastFrame ? (sky.lastFrame.recipeId ?? sky.lastFrame.recipe_id ?? null) : null,
      hemiVisible: +hemiVis.toFixed(5), hemiSceneWide: +hemiAll.toFixed(5), hemiRootColour: hemiCol,
      ambientVisible: +ambVis.toFixed(5), ambientSceneWide: +ambAll.toFixed(5), ambientRootColour: ambCol,
      environmentIntensity: +Number(R.scene.environmentIntensity).toFixed(5),
      hasEnvironment: !!R.scene.environment,
      cascadeCount: window.__cascades.length,
      shadowMapSizes: window.__cascades.map((o) => (o.shadow ? o.shadow.mapSize.x : null)),
      cfgError: window.__cfgError || null,
    };
  };
  return {
    sun: !!window.__sunLight, sky: !!window.__sky,
    cascades: window.__cascades.length,
    mapSizes: window.__cascades.map((o) => (o.shadow ? o.shadow.mapSize.x : null)),
  };
});
if (!setupOk.sun) { console.error('FATAL: cannot identify the sun light — every arm would be a silent no-op'); process.exit(3); }
console.log(`entry=${ENTRY} sun=ok sky=${setupOk.sky} cascades=${setupOk.cascades} maps=${JSON.stringify(setupOk.mapSizes)} renderer=${attestation.class}`);

const call = async (m, ...a) => {
  const res = await g.page.evaluate(async ({ method, callArgs }) => {
    const H = window.__HARNESS;
    if (typeof H[method] !== 'function') return { __err: `${method} IS NOT A HARNESS VERB` };
    try { return { __ok: await H[method](...callArgs) }; } catch (e) { return { __err: `${method}() threw: ${(e && e.message) || e}` }; }
  }, { method: m, callArgs: a });
  if (res && res.__err) { if (/IS NOT A HARNESS VERB/.test(res.__err)) throw new Error(res.__err); return { ok: false, e: String(res.__err).slice(0, 200) }; }
  return { ok: true, v: res ? res.__ok : undefined };
};

/** `char-npc` resolves through `listEntities` and THROWS rather than silently photographing the player. */
async function subjectPos(subject) {
  const s = await call('snapshot');
  if (!s.ok) throw new Error(`snapshot failed: ${s.e}`);
  let [px, py, pz] = s.v.player.pos;
  if (subject === 'npc') {
    const ents = await call('listEntities');
    const npcs = (ents.ok ? ents.v : []).filter((e) => e.kind === 'npc' || e.kind === 'NPC');
    if (!npcs.length) throw new Error('char-npc setup: no NPC in range — refusing to photograph the player and call it an NPC');
    npcs.sort((a, b) => Math.hypot(a.pos[0] - px, a.pos[2] - pz) - Math.hypot(b.pos[0] - px, b.pos[2] - pz));
    [px, py, pz] = npcs[0].pos;
  }
  return [px, py, pz];
}
async function poseAt([px, py, pz], { yaw_deg, pitch_deg, distance_m, lookHeight = 1.1 }) {
  const yaw = (yaw_deg || 0) * Math.PI / 180, pitch = (pitch_deg || 0) * Math.PI / 180, d = distance_m || 0;
  const eye = [px + Math.sin(yaw) * Math.cos(pitch) * d, py + 1.5 - Math.sin(pitch) * d, pz + Math.cos(yaw) * Math.cos(pitch) * d];
  const r = await call('camera', { pos: eye, look: [px, py + lookHeight, pz] });
  if (!r.ok) throw new Error(`camera pose refused: ${r.e}`);
}
async function capture(file, cfgSrc) {
  await g.page.evaluate(() => window.__restore());
  await g.page.evaluate(`window.__cfgFn = (${cfgSrc});`);
  await call('stepFrames', Number(args.settle || 3));
  const readback = await g.page.evaluate(() => window.__readback());
  const shot = await call('screenshot');
  if (!shot.ok) return { error: shot.e, readback };
  const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(file, buf);
  return {
    file: path.relative(REPO, file), sha256_16: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16),
    readback, liveness: gateBuffer(buf, { label: path.basename(file), subject: false, throwOnDegenerate: false }).verdict,
  };
}

// ---- the arms --------------------------------------------------------------------------------
const NOOP = '() => {}';
const amb = (h, f, e) => `() => { ${h === 1 ? '' : `window.__hemiScale(${h});`} ${f === 1 ? '' : `window.__fillScale(${f});`} ${e === 1 ? '' : `window.__envScale(${e});`} }`;

/**
 * `--mode ambient`. THE SWEEP. Aimed by the offline decomposition in this file's header: the probe
 * owns 83.2% of pair03's shadow quartile and the hemisphere+fill own 16.8%, so the sweep has to
 * carry BOTH and at multiples large enough to matter. `a0`/`a0b` bracket it with the shipped
 * configuration so the run carries its own S61 floor.
 */
const AMBIENT_ARMS = [
  ['a0-control', NOOP],
  ['a1-hemi2-fill2', amb(2, 2, 1)],
  ['a2-hemi4-fill4', amb(4, 4, 1)],
  ['a3-hemi8-fill8', amb(8, 8, 1)],
  ['a4-env2', amb(1, 1, 2)],
  ['a5-env3', amb(1, 1, 3)],
  ['a6-hemi4-fill4-env2', amb(4, 4, 2)],
  ['a7-hemi6-fill6-env15', amb(6, 6, 1.5)],
  ['a8-hemi8-fill8-env3', amb(8, 8, 3)],
  // ADDED AFTER THE FIRST FOUR ARMS CAME BACK AND FALSIFIED THE PRIOR THIS SWEEP WAS AIMED BY.
  // The offline decomposition said the probe owns 83.2% of pair03's shadow brightness, so the probe
  // looked like the lever. Measured: `env2` lifts the shadow quartile to mean Yp 0.0721 and reaches
  // `retention` 0.2737 — STILL a hard fail — while `hemi4-fill4` reaches a statistically
  // indistinguishable brightness (0.0755) and reaches `retention` 0.4141. So retention is NOT a
  // function of shadow brightness. The obvious explanation is that a PMREM probe adds a nearly
  // uniform irradiance to a small surface while a HemisphereLight's contribution depends on the
  // surface NORMAL — but that is a mechanism, and S63 forbids narrating one I have not ablated.
  // These three arms are the ablation: `hemi` and `fill` separated, at matched total.
  ['a9-hemi8-fill1', amb(8, 1, 1)],
  ['a10-hemi1-fill8', amb(1, 8, 1)],
  ['a11-hemi5-fill2', amb(5, 2, 1)],
  ['a0b-control-recheck', NOOP],
];

/** `--mode windows`/`weather`: the arms S60 and §2-D3 both need, same process, recheck LAST. */
const WINDOW_ARMS = [
  ['base', NOOP],
  ['shadows_off', '() => { for (const o of window.__cascades) if (o.shadow) o.shadow.intensity = 0; }'],
  ['key_off', '() => { const s = window.__scene(); s.traverse((o) => { if (o.isDirectionalLight && o.parent === s) o.intensity = 0; }); }'],
  ['env_off', '() => { window.__envScale(0); }'],
  ['base_recheck', NOOP],
];

const manifest = {
  at: new Date().toISOString(), mode: MODE, tag: TAG, entry: ENTRY, served: servedSources(ENTRY),
  renderer: attestation, resolution: [CW, CH], seed: SEED,
  evidence_class: attestation && attestation.class === 'HARDWARE' ? 'HARDWARE' : 'SOFTWARE — differential only (HAZARDS §15)',
  contention_note: String(args.contention || 'not recorded'),
  windows: WINDOWS, rows: [], aborted: null,
};
const reportPath = path.join(OUT, `${TAG}.json`);
const flush = () => { if (manifest.rows.length) fs.writeFileSync(reportPath, JSON.stringify(manifest, null, 2)); };

async function place(setupId, weather = 'clear') {
  const st = DECK.setups.find((x) => x.id === setupId);
  const where = await call('whereAmI');
  if (where.ok && where.v && where.v.interior) await call('exitInterior');
  await call('teleport', st.place.x, st.place.z);
  await call('stepFrames', 4);
  const w = await call('setWeather', weather);
  if (!w.ok) throw new Error(`setWeather('${weather}') refused: ${w.e}`);
  return st;
}

console.log(`served sky.js=${manifest.served['src/render/sky.js']} recipes=${manifest.served['src/render/lib/lighting-recipes.js']}`);
try {
  if (MODE === 'ambient') {
    const win = WINDOWS.find((w) => w.pair === String(args.pair || 'pair03'));
    const st = await place(win.setup, String(args.weather || 'clear'));
    await call('setTimeOfDay', win.hour);
    await poseAt(await subjectPos(st.camera.subject), st.camera);
    await call('stepFrames', SETTLE);
    const arms = args.arms ? String(args.arms).split(',') : AMBIENT_ARMS.map(([id]) => id);
    for (const [id, cfg] of AMBIENT_ARMS.filter(([id]) => arms.includes(id))) {
      const r = await capture(path.join(OUT, `${win.pair}__${id}.png`), cfg);
      manifest.rows.push({ mode: MODE, pair: win.pair, hour: win.hour, crop: win.crop, arm: id, ...r });
      flush();
      console.log(`  ${id.padEnd(24)} ${r.liveness || 'ERR'} hemi=${r.readback && r.readback.hemiVisible} fill=${r.readback && r.readback.ambientVisible} env=${r.readback && r.readback.environmentIntensity} recipe=${r.readback && r.readback.recipeId}`);
    }
  }

  if (MODE === 'windows' || MODE === 'weather') {
    const weather = String(args.weather || 'clear');
    for (const pair of String(args.pairs || 'pair03').split(',')) {
      const win = WINDOWS.find((w) => w.pair === pair);
      if (!win) { console.error(`unknown pair '${pair}'`); continue; }
      const st = await place(win.setup, weather);
      await call('setTimeOfDay', win.hour);
      await poseAt(await subjectPos(st.camera.subject), st.camera);
      await call('stepFrames', SETTLE);
      const rig = await g.page.evaluate(() => window.__shadowRig());
      manifest.rows.push({ mode: MODE, pair: win.pair, weather, hour: win.hour, shadow_rig: rig });
      flush();
      for (const [id, cfg] of WINDOW_ARMS) {
        const r = await capture(path.join(OUT, `${win.pair}__${id}.png`), cfg);
        manifest.rows.push({ mode: MODE, pair: win.pair, weather, hour: win.hour, crop: win.crop, arm: id, ...r });
        flush();
        console.log(`  ${pair}/${weather} ${id.padEnd(14)} ${r.liveness || 'ERR'} sunI=${r.readback && r.readback.sunIntensity} env=${r.readback && r.readback.environmentIntensity} recipe=${r.readback && r.readback.recipeId}`);
      }
    }
  }

  if (MODE === 'orbit') {
    const hour = Number(args.hour || 8);
    const st = await place('char-player', String(args.weather || 'clear'));
    await call('setTimeOfDay', hour);
    await call('stepFrames', 4);
    const s = await call('snapshot');
    /**
     * `--ablate` captures the S60 / §2-D3 arms AT AN ORBIT POSE. No round of F4 and no F4 critic
     * has ever done this, and it is the gap that makes every orbit number in this item's history
     * unreadable: `RI-VIS04` §2-D3 makes `hue_offset` conditional on a same-run `key_off` arm, and
     * without one the reading is neither a pass nor a hard fail — §2-D3's own overturn clause says
     * the budget is recorded `UNVERIFIED`, which counts as absent. Three rounds have argued about
     * "the morning fails at 8 of 8" on readings that cannot legally be quoted either way.
     */
    const orbitArms = args.ablate
      ? [['base', NOOP], ...WINDOW_ARMS.filter(([id]) => id === 'key_off' || id === 'shadows_off'), ['base_recheck', NOOP]]
      : [['', NOOP]];
    for (const yaw of String(args.yaws || '0,45,90,135,180,225,270,315').split(',').map(Number)) {
      await poseAt(s.v.player.pos, { yaw_deg: yaw, pitch_deg: -8, distance_m: 7, lookHeight: 1.1 });
      await call('stepFrames', SETTLE);
      const rig = await g.page.evaluate(() => window.__shadowRig());
      for (const [armId, cfg] of orbitArms) {
        const stem = `orbit-t${hour}-y${String(yaw).padStart(3, '0')}${armId ? `__${armId}` : ''}`;
        const r = await capture(path.join(OUT, `${stem}.png`), cfg);
        manifest.rows.push({ mode: MODE, hour, yaw, arm: armId || 'base', shadow_rig: rig, ...r });
        flush();
        console.log(`  orbit t=${hour} yaw=${yaw} ${(armId || 'base').padEnd(13)} ${r.liveness || 'ERR'} cascades=${rig.cascade_count} (scene-wide ${rig.cascade_count_scene_wide_DO_NOT_QUOTE}) type=${rig.shadowMapTypeName} texel=${JSON.stringify(rig.casters.map((c) => c.texel_m))}`);
      }
    }
  }

  if (MODE === 'walk') {
    const hour = Number(args.hour || 13);
    await place('char-player', String(args.weather || 'clear'));
    await call('setTimeOfDay', hour);
    await call('stepFrames', SETTLE);
    const s0 = await call('snapshot');
    const start = [...s0.v.player.pos];
    await poseAt(start, { yaw_deg: 180, pitch_deg: -10, distance_m: 5.0, lookHeight: 1.2 });
    for (let k = 0; k < Number(args.frames || 5); k++) {
      const script = []; for (let f = 0; f < 10; f++) script.push({ f, move: [0, 1] });
      const q = await call('queueInputs', script);
      if (!q.ok) { manifest.rows.push({ mode: 'walk', hour, k, error: q.e }); flush(); break; }
      await call('stepFrames', 10);
      const s1 = await call('snapshot');
      const p = s1.ok ? s1.v.player.pos : null;
      if (p) await poseAt(p, { yaw_deg: 180, pitch_deg: -10, distance_m: 5.0, lookHeight: 1.2 });
      const r = await capture(path.join(OUT, `walk-t${hour}-f${String(k).padStart(2, '0')}.png`), NOOP);
      const moved = p ? +Math.hypot(p[0] - start[0], p[2] - start[2]).toFixed(3) : null;
      manifest.rows.push({ mode: 'walk', hour, k, moved_m_from_start: moved, pos: p, ...r });
      flush();
      console.log(`  walk t=${hour} k=${k} moved=${moved}m ${r.liveness || 'ERR'}`);
    }
  }

  if (MODE === 'shadowfit') {
    const st = await place('char-player', String(args.weather || 'clear'));
    for (const hour of String(args.hours || '8,13').split(',').map(Number)) {
      await call('setTimeOfDay', hour);
      const s = await call('snapshot');
      await poseAt(s.v.player.pos, st.camera);
      await call('stepFrames', SETTLE);
      const rig = await g.page.evaluate(() => window.__shadowRig());
      const census = await g.page.evaluate(() => window.__lightCensus());
      manifest.rows.push({ mode: MODE, hour, shadow_rig: rig, census: census.filter((c) => c.chain_visible && c.intensity > 0) });
      flush();
      console.log(`  t=${hour} cascades=${rig.cascade_count} maps=${JSON.stringify(rig.casters.map((c) => c.mapSize))} extents=${JSON.stringify(rig.casters.map((c) => c.extent_m))} texels=${JSON.stringify(rig.casters.map((c) => c.texel_m))} dist=${rig.shadowDistance_m} splits=${JSON.stringify(rig.splits_m)}`);
    }
  }
} catch (e) {
  manifest.aborted = String((e && e.stack) || e);
  console.error('ABORTED:', manifest.aborted);
} finally {
  // HAZARDS §18: an empty run may not overwrite a full one.
  if (!manifest.rows.length && fs.existsSync(reportPath)) {
    console.error(`REFUSED to overwrite ${reportPath} with a zero-row run (HAZARDS §18)`);
    process.exitCode = 4;
  } else {
    fs.writeFileSync(reportPath, JSON.stringify(manifest, null, 2));
    console.log(`wrote ${path.relative(REPO, reportPath)} — ${manifest.rows.length} row(s)`);
  }
  await g.close().catch(() => {});
}
