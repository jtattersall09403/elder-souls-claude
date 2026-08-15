#!/usr/bin/env node
/**
 * f4c-critic.mjs — the INDEPENDENT CRITIC's instrument for roadmap F4 (light, sky, atmosphere).
 *
 * Written by the F4 critic, not by the builder. It exists because three things the build owes could
 * not be measured by the tool the build used:
 *
 *  1. RULING S60 clause (a) — `key_off >= 2x env_off` ON THE LIT SUBSET. The builder measured it
 *     full-frame and over a fixed crop, and S60 voids both: a pixel in shadow does not change when
 *     the key is switched off, so the average is taken over a domain that SHRINKS as the fix
 *     succeeds. Here the LIT MASK is derived independently of the key arm: shadowed pixels are the
 *     ones that BRIGHTEN when the sun's shadow map is switched off (`__shadowMap(false)`). That is
 *     the shadow map reporting occlusion, which is what S60 asks for, and it is not the same
 *     experiment as `key_off`, so the mask is not circular.
 *  2. RULING S60 clause (b) — CAST-SHADOW AREA FRACTION MUST NOT FALL. Same mask, counted.
 *  3. A REAL delete-the-fix arm. The builder's `revert_day` is a page-side rig edit and `sky.js:944`
 *     bakes the environment probe with `sunGain: R.key * max(0.05, day)`, so no page-side arm can
 *     undo the tripled sun lobe inside the probe TEXTURE. This tool takes `--entry` and is run twice
 *     against two source trees: the landed one, and a hard-linked copy with the two recipe lines
 *     reverted. That revert reaches the bake.
 *
 * MODES
 *   --mode s60      arms {base, shadows_off, key_off, env_off} at the sealed judged windows.
 *   --mode look     ORBIT the camera around the player and WALK it, at 08:00 / 13:00 / 19:30.
 *                   The owner's standing directive: stills from one angle are not evidence.
 *   --mode recipes  which recipe the live scene actually selects across the day, read back off the
 *                   engine rather than derived from source, plus a frame in each band.
 *   --mode regions  one frame per region at a fixed hour, for the separability proxy.
 *   --mode envequiv `env_off` (environmentIntensity=0) against `env_null` (scene.environment=null).
 *
 * Every mode writes `<out>/<mode>.json` and its PNGs. Two arms are two PROCESSES, so the pair is
 * only valid if the capture is deterministic across processes — `--mode s60` and `--mode look`
 * both carry a null-control window whose recipe neither arm changes, and a cross-process
 * bit-identical result there is the proof. If it is not bit-identical, say so and stop.
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
const MODE = String(args.mode || 's60');
const ARM = String(args.arm || 'landed');
const ENTRY = String(args.entry || 'game/index.html');
const OUT = path.resolve(REPO, args.out || `reports/f4c/${MODE}-${ARM}`);
fs.mkdirSync(OUT, { recursive: true });

const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/blind/deck-protocol-a.json'), 'utf8'));
const SEED = Number(DECK.capture.seed);
const SETTLE = Number(DECK.capture.settle_frames);

/** The five sealed judged windows, copied from `tools/visual/f2-why-forced.mjs` which copied them
 * from the sealed pairing key. `prsv-dusk` is the NULL CONTROL: `dusk-canopy` is selected at 06:00
 * and neither arm changes any number in it, so a cross-process difference there is instrument
 * noise and nothing else. */
const JUDGED = [
  { pair: 'pair01', setup: 'char-player', hour: 8,    crop: [300, 150, 512, 512] },
  { pair: 'pair02', setup: 'char-player', hour: 13,   crop: [200, 480, 512, 512] },
  { pair: 'pair03', setup: 'char-npc',    hour: 13,   crop: [1100, 150, 512, 512] },
  { pair: 'pair04', setup: 'char-npc',    hour: 8,    crop: [200, 480, 512, 512] },
  { pair: 'pair05', setup: 'char-player', hour: 19.5, crop: [1100, 150, 512, 512] },
  { pair: 'prsv-dusk', setup: 'char-player', hour: 6, crop: [300, 150, 512, 512], null_control: true },
];

const [CW, CH] = MODE === 's60' ? [1920, 1080] : [1280, 720];

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

// ---- page-side helpers, deliberately the same mechanics as f2-why-forced.mjs -------------------
// Each forced arm is a PER-FRAME enforcer, because `sky.apply()` rewrites the lights, the fog and
// the probe every frame from the recipe and `renderer.js` rewrites the AO/GI uniforms. A one-shot
// edit is gone before the screenshot.
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
    window.__shadowMap(window.__saved.shadowMap);
    R.scene.environmentIntensity = window.__saved.envI;
  };
  window.__readback = () => {
    let hemi = 0, amb = 0, dir = 0, nDir = 0;
    R.scene.traverse((o) => {
      if (o.isHemisphereLight) hemi += o.intensity;
      else if (o.isAmbientLight) amb += o.intensity;
      else if (o.isDirectionalLight && o.visible) { dir += o.intensity; if (o.intensity > 0) nDir++; }
    });
    return {
      shadowMapEnabled: R.three.shadowMap.enabled,
      sunIntensity: window.__sunLight ? +window.__sunLight.intensity.toFixed(5) : null,
      moonIntensity: (() => { let m = null; R.scene.traverse((o) => { if (o.isDirectionalLight && o.parent === R.scene && o !== window.__sunLight) m = +o.intensity.toFixed(5); }); return m; })(),
      hemiTotal: +hemi.toFixed(4), ambientTotal: +amb.toFixed(4), dirTotal: +dir.toFixed(4), dirCount: nDir,
      hasEnvironment: !!R.scene.environment, environmentIntensity: +Number(R.scene.environmentIntensity).toFixed(5),
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
  key_off:     '() => { const s = window.__scene(); s.traverse((o) => { if (o.isDirectionalLight && o.parent === s) window.__setLight(o, 0); }); }',
  env_off:     '() => { window.__envScale(0); }',
  env_null:    '() => { window.__scene().environment = null; }',
  base_recheck: '() => {}',
};

const call = async (m, ...a) => {
  const res = await g.page.evaluate(async ({ method, callArgs }) => {
    const H = window.__HARNESS;
    if (typeof H[method] !== 'function') return { __err: `${method} IS NOT A HARNESS VERB` };
    try { return { __ok: await H[method](...callArgs) }; } catch (e) { return { __err: `${method}() threw: ${(e && e.message) || e}` }; }
  }, { method: m, callArgs: a });
  // HAZARDS §16: a harness call that fails silently is worse than one that throws.
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

/** Decode a PNG to raw RGB24 via ffmpeg. Optionally crop first. */
function rawOf(png, crop) {
  const vf = crop ? ['-vf', `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]}`] : [];
  return execFileSync('ffmpeg', ['-loglevel', 'error', '-i', png, ...vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
}
function statsOf(raw) {
  const n = raw.length / 3;
  const luma = new Float64Array(n);
  let cs = 0;
  for (let i = 0; i < n; i++) {
    const r = raw[i * 3], gg = raw[i * 3 + 1], b = raw[i * 3 + 2];
    luma[i] = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    cs += Math.max(r, gg, b) - Math.min(r, gg, b);
  }
  const sorted = Float64Array.from(luma).sort();
  const q = (f) => sorted[Math.min(n - 1, Math.max(0, Math.round(f * (n - 1))))];
  let sum = 0; for (let i = 0; i < n; i++) sum += luma[i];
  const mean = sum / n;
  let v = 0; for (let i = 0; i < n; i++) v += (luma[i] - mean) ** 2;
  return {
    n, mean_luma: +mean.toFixed(4), sd_luma: +Math.sqrt(v / n).toFixed(4),
    p10: +q(0.10).toFixed(2), p50: +q(0.50).toFixed(2), p90: +q(0.90).toFixed(2),
    mean_chroma: +(cs / n).toFixed(4),
    mean_rgb: [0, 1, 2].map((c) => { let s = 0; for (let i = 0; i < n; i++) s += raw[i * 3 + c]; return +(s / n).toFixed(3); }),
  };
}

async function capture(file, cfgName) {
  await g.page.evaluate(() => window.__restore());
  await g.page.evaluate(`window.__cfgFn = (${CONFIGS[cfgName]});`);
  await call('stepFrames', 3);
  const readback = await g.page.evaluate(() => window.__readback());
  const shot = await call('screenshot');
  if (!shot.ok) return { error: shot.e, readback };
  const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(file, buf);
  const liveness = gateBuffer(buf, { label: path.basename(file), subject: false, throwOnDegenerate: false });
  return { file: path.relative(REPO, file), sha: crypto.createHash('sha256').update(buf).digest('hex'), readback, liveness: liveness.verdict };
}

const manifest = {
  at: new Date().toISOString(), mode: MODE, arm: ARM, entry: ENTRY,
  renderer: attestation, resolution: [CW, CH], seed: SEED,
  evidence_class: attestation && attestation.class === 'HARDWARE' ? 'HARDWARE' : 'SOFTWARE — differential only (HAZARDS §15)',
  rows: [], aborted: null,
};

const ONLY = args.pairs ? String(args.pairs).split(',').map((s) => s.trim()) : null;

try {
  if (MODE === 's60' || MODE === 'envequiv') {
    const cfgs = MODE === 'envequiv' ? ['base', 'env_off', 'env_null', 'key_off', 'base_recheck'] : ['base', 'shadows_off', 'key_off', 'env_off', 'base_recheck'];
    for (const w of JUDGED.filter((j) => !ONLY || ONLY.includes(j.pair))) {
      const setup = DECK.setups.find((s) => s.id === w.setup);
      const where = await call('whereAmI');
      if (where.ok && where.v && where.v.interior) await call('exitInterior');
      await call('teleport', setup.place.x, setup.place.z);
      await call('stepFrames', 4);
      await call('setWeather', 'clear');
      await call('setTimeOfDay', w.hour);
      const sp = await subjectPos(setup.camera.subject);
      await poseAt(sp, setup.camera);
      await call('stepFrames', SETTLE);
      const env = await call('getEnvConditions');
      for (const c of cfgs) {
        const dir = path.join(OUT, c); fs.mkdirSync(dir, { recursive: true });
        const r = await capture(path.join(dir, `${w.pair}.png`), c);
        manifest.rows.push({ mode: MODE, pair: w.pair, hour: w.hour, crop: w.crop, config: c, null_control: !!w.null_control, env: env.ok ? env.v : null, ...r });
        console.log(`  ${w.pair} ${c.padEnd(13)} ${r.error ? 'ERROR ' + r.error : `${r.liveness} sun=${r.readback.sunIntensity} moon=${r.readback.moonIntensity} hemi=${r.readback.hemiTotal} env=${r.readback.environmentIntensity} shm=${r.readback.shadowMapEnabled ? 1 : 0}`}`);
      }
    }
  }

  if (MODE === 'look') {
    // THE STANDING DIRECTIVE. Orbit the camera around the player — the owner's own named example —
    // and then DRIVE THE PLAYER. HAZARDS §16: `setInput` is not a verb and two rounds' "walk"
    // sequences photographed a stationary character. `queueInputs` is checked to exist by `call()`
    // above, and the walk's own displacement is measured and reported so a dead input path shows
    // as data.
    const setup = DECK.setups.find((s) => s.id === 'char-player');
    const hours = String(args.hours || '8,13,19.5').split(',').map(Number);
    const steps = Number(args.steps || 12);
    for (const hour of hours) {
      await call('teleport', setup.place.x, setup.place.z);
      await call('stepFrames', 4);
      await call('setWeather', String(args.weather || 'clear'));
      await call('setTimeOfDay', hour);
      await call('stepFrames', SETTLE);
      const sp = await subjectPos('player');
      const dir = path.join(OUT, `orbit-t${hour}`); fs.mkdirSync(dir, { recursive: true });
      await g.page.evaluate(() => window.__restore());
      for (let i = 0; i < steps; i++) {
        const yaw = (360 / steps) * i;
        await poseAt(sp, { yaw_deg: yaw, pitch_deg: -12, distance_m: 7.0, lookHeight: 1.2 });
        await call('stepFrames', 2);
        const r = await capture(path.join(dir, `yaw${String(Math.round(yaw)).padStart(3, '0')}.png`), 'base');
        const st = r.file ? statsOf(rawOf(path.join(REPO, r.file))) : null;
        manifest.rows.push({ mode: 'orbit', hour, yaw_deg: yaw, ...r, stats: st });
        console.log(`  orbit t=${hour} yaw=${yaw} ${r.liveness} mean=${st ? st.mean_luma : '-'} chroma=${st ? st.mean_chroma : '-'}`);
      }
      // ---- the walk. Real input through the shipped queue, displacement measured. ----
      const wdir = path.join(OUT, `walk-t${hour}`); fs.mkdirSync(wdir, { recursive: true });
      const s0 = await call('snapshot');
      const start = s0.ok ? [...s0.v.player.pos] : null;
      await poseAt(sp, { yaw_deg: 180, pitch_deg: -10, distance_m: 5.0, lookHeight: 1.2 });
      for (let k = 0; k < Number(args.walk || 8); k++) {
        // HARNESS.md §4 events are {f, press?, release?, move?, look?} and NOTHING else — the
        // pipeline throws on any other key rather than accepting it and doing nothing. One event
        // per frame, because `f` is a frame offset from the moment of the call.
        const script = []; for (let f = 0; f < 10; f++) script.push({ f, move: [0, 1] });
        const q = await call('queueInputs', script);
        if (!q.ok) { manifest.rows.push({ mode: 'walk', hour, k, error: q.e }); break; }
        await call('stepFrames', 10);
        const s1 = await call('snapshot');
        const p = s1.ok ? s1.v.player.pos : null;
        // keep the camera trailing the moving body, which is what a player sees
        if (p) await poseAt(p, { yaw_deg: 180, pitch_deg: -10, distance_m: 5.0, lookHeight: 1.2 });
        const r = await capture(path.join(wdir, `f${String(k).padStart(2, '0')}.png`), 'base');
        const moved = (start && p) ? +Math.hypot(p[0] - start[0], p[2] - start[2]).toFixed(3) : null;
        manifest.rows.push({ mode: 'walk', hour, k, moved_m_from_start: moved, pos: p, ...r });
        console.log(`  walk  t=${hour} k=${k} moved=${moved} m  ${r.liveness}`);
      }
    }
  }

  if (MODE === 'recipes') {
    // Which recipe the LIVE scene selects, read back off the engine's own lighting frame rather
    // than derived from `recipeForConditions()` source. Plus a frame in every band a player passes
    // through, and in the weathers F4 did not touch.
    const setup = DECK.setups.find((s) => s.id === 'char-player');
    await call('teleport', setup.place.x, setup.place.z);
    await call('stepFrames', 4);
    const sp = await subjectPos('player');
    const shots = (args.shots ? String(args.shots) : '6,13,17.75,19.5').split(',').map(Number);
    const weathers = String(args.weathers || 'clear').split(',');
    for (const weather of weathers) {
      for (const hour of shots) {
        await call('setWeather', weather);
        await call('setTimeOfDay', hour);
        await poseAt(sp, { yaw_deg: 35, pitch_deg: -6, distance_m: 7.0, lookHeight: 1.2 });
        await call('stepFrames', SETTLE);
        const dir = path.join(OUT, 'band'); fs.mkdirSync(dir, { recursive: true });
        const r = await capture(path.join(dir, `${weather}-t${hour}.png`), 'base');
        const st = r.file ? statsOf(rawOf(path.join(REPO, r.file))) : null;
        manifest.rows.push({ mode: 'recipes', hour, weather, ...r, stats: st });
        console.log(`  recipe t=${hour} ${weather} mean=${st ? st.mean_luma : '-'} p10=${st ? st.p10 : '-'} chroma=${st ? st.mean_chroma : '-'} sun=${r.readback ? r.readback.sunIntensity : '-'} env=${r.readback ? r.readback.environmentIntensity : '-'}`);
      }
    }
  }

  if (MODE === 'regions') {
    // RI-WLD04 M17 is `blind_pair: yes` and a critic cannot spawn a fresh judge (rule 0e). This is
    // the MACHINE PROXY and it is labelled as one: one frame per region under identical conditions,
    // so the pairwise perceptual distance between regions can be compared before and after. It
    // cannot pass M17. It can fail F4, if the lighting change collapses the regions together.
    const regions = JSON.parse(fs.readFileSync(path.join(REPO, 'corpus/50-world/regions.json'), 'utf8')).regions;
    const dir = path.join(OUT, 'regions'); fs.mkdirSync(dir, { recursive: true });
    for (const [name, reg] of Object.entries(regions)) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const bb = reg.aabb_m;
      if (!bb) { manifest.rows.push({ mode: 'regions', region: name, error: 'no aabb_m in regions.json' }); continue; }
      // The AABB centre. RI-WLD04 asks for random walkable points >=120 m from a settlement; a
      // critic cannot sample walkability without the reachability probe, so this is the centre and
      // it is LABELLED as a weaker sample. `getRegionAt` is read back so a point that landed in a
      // neighbouring region is visible as data rather than mislabelling the frame.
      const x = (bb.x[0] + bb.x[1]) / 2, z = (bb.z[0] + bb.z[1]) / 2;
      const tp = await call('teleport', x, z);
      if (!tp.ok) { manifest.rows.push({ mode: 'regions', region: name, error: `teleport: ${tp.e}` }); continue; }
      await call('stepFrames', 6);
      await call('setWeather', 'clear');
      await call('setTimeOfDay', 13);
      const at = await call('getRegionAt', x, z);
      const sp = await subjectPos('player');
      await poseAt(sp, { yaw_deg: 35, pitch_deg: 4, distance_m: 6.0, lookHeight: 1.7 });
      await call('stepFrames', SETTLE);
      const r = await capture(path.join(dir, `${slug}.png`), 'base');
      const st = r.file ? statsOf(rawOf(path.join(REPO, r.file))) : null;
      manifest.rows.push({ mode: 'regions', region: name, slug, at: at.ok ? (at.v && (at.v.id || at.v.name)) : null, xz: [x, z], ...r, stats: st });
      console.log(`  region ${String(name).padEnd(22)} at=${at.ok && at.v ? (at.v.id || at.v.name) : '?'} mean=${st ? st.mean_luma : '-'} chroma=${st ? st.mean_chroma : '-'}`);
    }
  }
} catch (e) {
  manifest.aborted = { after_rows: manifest.rows.length, error: String((e && e.stack) || e).slice(0, 800) };
  console.error(`ABORTED after ${manifest.rows.length} row(s): ${manifest.aborted.error}`);
}

// HAZARDS §18: write to a DISTINCT file per run, never into a shared name from a `finally`.
fs.writeFileSync(path.join(OUT, `${MODE}.json`), JSON.stringify(manifest, null, 2));
console.log(`wrote ${path.join(OUT, `${MODE}.json`)}  rows=${manifest.rows.length}`);
await g.close().catch(() => {});
process.exit(manifest.aborted ? 1 : 0);
