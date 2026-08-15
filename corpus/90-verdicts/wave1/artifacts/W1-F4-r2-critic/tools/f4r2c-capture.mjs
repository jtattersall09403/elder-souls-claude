/**
 * F4 ROUND-2 CRITIC'S CAPTURE TOOL.
 *
 * THREE THINGS THE ROUND DID NOT DO, AND ONE IT WROTE AND NEVER FIRED.
 *
 *  1. `--mode lights` — WHAT IS ACTUALLY IN THE FRAME. The round's headline ablation is reported
 *     as *"switching off a HemisphereLight of live intensity 5.0011"*. `f4-r2-light.mjs`'s
 *     readback SUMS `o.intensity` over every `isHemisphereLight` in the scene graph, and
 *     `grep -n 'HemisphereLight' game/src/` returns FIVE construction sites — `sky.js:598`,
 *     `scene.js:283` (arena), `scene.js:501` (rootway), `interior.js:909`, `places.js:44`. This
 *     mode enumerates every light with its name, its parent chain and whether that chain is
 *     visible, so "which light did the arm switch off" stops being an inference.
 *
 *  2. `--mode battery` — THE ARMS THE ROUND'S OWN TOOL CONTAINS AND NEVER RAN. `f4-r2-light.mjs`
 *     defines TWO candidate sets, `soft` and `hard`. The status file reports seven `soft`
 *     candidates and rules that *"the lever class is exhausted"*. `hard` — `WARM_HARD`,
 *     `COOL_HARD` and `mixRaw`, i.e. the same lever WITHOUT the constant-luminance normaliser
 *     that the tool's own comment says *"pulls a lerp back toward where it started"* — appears in
 *     no metric file and no row of the status file. This mode fires it, plus the one
 *     configuration the ruling's own mechanism predicts and nobody tested: the NIGHT's illuminant
 *     geometry applied BY DAY (the key set to `sky.js:644`'s hardcoded `0x8ca9d8` against a warm
 *     ambient), because the ruling's strongest evidence is that the night reaches 22-33 deg.
 *
 *  3. `--mode walk` — MOTION. The round captured twelve orbit angles and ZERO moving frames, by
 *     its own account weaker than the critic that judged the round before it. HAZARDS §16:
 *     displacement is measured per frame so a dead input path shows up as data.
 *
 * ARMS ARE PAGE-SIDE AND PER-FRAME, applied in `scene.onBeforeRender` because `sky.apply()`
 * rewrites every light every frame. KNOWN AND DECLARED BLIND SPOT, inherited from the round's own
 * tool and true of every page-side arm here: `bakeEnvironmentProbe()` consumes the SUN COLOUR, so
 * recolouring the key page-side does not recolour the probe's sun lobe. That makes every key-hue
 * arm below a LOWER BOUND on what the same change would do in source, which is the safe direction
 * for a critic trying to falsify "no configuration reaches 15".
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
const MODE = String(args.mode || 'battery');
const ENTRY = String(args.entry || 'game/index.html');
const OUT = path.resolve(REPO, args.out || `reports/f4r2c/${MODE}`);
fs.mkdirSync(OUT, { recursive: true });
const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/blind/deck-protocol-a.json'), 'utf8'));
const SEED = Number(DECK.capture.seed);
const SETTLE = Number(DECK.capture.settle_frames);
const [CW, CH] = String(args.res || '1920x1080').split('x').map(Number);

/** HAZARDS §22: which lighting source this arm actually SERVED, recorded rather than assumed. */
function servedSources(entry) {
  const gameDir = path.dirname(path.resolve(entry));
  const out = {};
  for (const rel of ['src/render/lib/lighting-recipes.js', 'src/render/sky.js']) {
    const p = path.join(gameDir, rel);
    out[rel] = fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16) : null;
  }
  return { game_dir: gameDir, sha256_16: out };
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

const setupOk = await g.page.evaluate(() => {
  const R = window.__ENGINE.renderer;
  window.__scene = () => R.scene;
  window.__sunLight = null;
  R.scene.traverse((o) => {
    if (o.isDirectionalLight && o.castShadow && o.shadow && o.shadow.mapSize.x >= 2048) window.__sunLight = o;
  });
  window.__setLight = (o, v) => { o.intensity = v; };
  window.__envScale = (k) => {
    const s = R.scene;
    if (s.__envWrote === undefined || s.__envWrote !== s.environmentIntensity) s.__envBase = s.environmentIntensity;
    s.environmentIntensity = s.__envBase * k;
    s.__envWrote = s.environmentIntensity;
  };
  /** EVERY light, with the chain that decides whether it can reach a pixel. */
  window.__lightCensus = () => {
    const rows = [];
    R.scene.traverse((o) => {
      if (!o.isLight) return;
      const chain = [];
      let p = o, visible = true;
      while (p) { chain.push(p.name || p.type); if (p.visible === false) visible = false; p = p.parent; }
      rows.push({
        name: o.name || '(unnamed)', type: o.type,
        intensity: +Number(o.intensity).toFixed(5),
        colour: o.color ? o.color.toArray().map((v) => +v.toFixed(4)) : null,
        groundColour: o.groundColor ? o.groundColor.toArray().map((v) => +v.toFixed(4)) : null,
        self_visible: o.visible !== false, chain_visible: visible,
        layers_mask: o.layers ? o.layers.mask : null,
        parent_chain: chain.slice(1).join(' < '),
      });
    });
    return rows;
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
    // the cheap §3-D2 ablation is a UNIFORM, so it survives a light-intensity restore and would
    // leak into every later arm if it were not put back explicitly.
    if (window.__sunLight && window.__sunLight.shadow) window.__sunLight.shadow.intensity = 1;
    delete R.scene.__envWrote; delete R.scene.__envBase;
    R.scene.environmentIntensity = window.__saved.envI;
  };
  window.__readback = () => {
    const sun = window.__sunLight;
    let hemi = 0, amb = 0, skyHemi = null;
    let hemiCol = null, ambCol = null, sunCol = null;
    R.scene.traverse((o) => {
      if (o.isHemisphereLight) {
        hemi += o.intensity;
        if (o.parent === R.scene) { skyHemi = +o.intensity.toFixed(5); hemiCol = o.color.toArray().map((v) => +v.toFixed(4)); }
      } else if (o.isAmbientLight) { amb += o.intensity; if (o.parent === R.scene) ambCol = o.color.toArray().map((v) => +v.toFixed(4)); }
    });
    if (sun) sunCol = sun.color.toArray().map((v) => +v.toFixed(4));
    const dir = sun ? (() => { const p = sun.position, t = sun.target.position; const d = [p.x - t.x, p.y - t.y, p.z - t.z]; const L = Math.hypot(...d); return d.map((v) => +(v / L).toFixed(4)); })() : null;
    return {
      sunIntensity: sun ? +sun.intensity.toFixed(5) : null, sunColour: sunCol,
      sunDirUnit: dir, sunElevationDeg: dir ? +(Math.asin(dir[1]) * 180 / Math.PI).toFixed(3) : null,
      hemiTotalSceneWide: +hemi.toFixed(4), hemiSceneRoot: skyHemi, hemiRootColour: hemiCol,
      ambientTotalSceneWide: +amb.toFixed(4), ambientRootColour: ambCol,
      environmentIntensity: +Number(R.scene.environmentIntensity).toFixed(5),
      hasEnvironment: !!R.scene.environment,
      cfgError: window.__cfgError || null,
    };
  };
  return { sun: !!window.__sunLight, mapSize: window.__sunLight ? window.__sunLight.shadow.mapSize.x : null };
});
if (!setupOk.sun) { console.error('FATAL: cannot identify the sun light — every arm would be a silent no-op'); process.exit(3); }
console.log(`entry=${ENTRY} sun found shadowMap=${setupOk.mapSize} renderer=${attestation.class}`);

const call = async (m, ...a) => {
  const res = await g.page.evaluate(async ({ method, callArgs }) => {
    const H = window.__HARNESS;
    if (typeof H[method] !== 'function') return { __err: `${method} IS NOT A HARNESS VERB` };
    try { return { __ok: await H[method](...callArgs) }; } catch (e) { return { __err: `${method}() threw: ${(e && e.message) || e}` }; }
  }, { method: m, callArgs: a });
  if (res && res.__err) { if (/IS NOT A HARNESS VERB/.test(res.__err)) throw new Error(res.__err); return { ok: false, e: String(res.__err).slice(0, 200) }; }
  return { ok: true, v: res ? res.__ok : undefined };
};

async function poseAt([px, py, pz], { yaw_deg, pitch_deg, distance_m, lookHeight = 1.1 }) {
  const yaw = (yaw_deg || 0) * Math.PI / 180, pitch = (pitch_deg || 0) * Math.PI / 180;
  const d = distance_m || 0;
  const eye = [px + Math.sin(yaw) * Math.cos(pitch) * d, py + 1.5 - Math.sin(pitch) * d, pz + Math.cos(yaw) * Math.cos(pitch) * d];
  const r = await call('camera', { pos: eye, look: [px, py + lookHeight, pz] });
  if (!r.ok) throw new Error(`camera pose refused: ${r.e}`);
}

async function capture(file, cfgSrc) {
  await g.page.evaluate(() => window.__restore());
  await g.page.evaluate(`window.__cfgFn = (${cfgSrc});`);
  await call('stepFrames', 3);
  const readback = await g.page.evaluate(() => window.__readback());
  const shot = await call('screenshot');
  if (!shot.ok) return { error: shot.e, readback };
  const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(file, buf);
  const liveness = gateBuffer(buf, { label: path.basename(file), subject: false, throwOnDegenerate: false });
  return { file: path.relative(REPO, file), sha: crypto.createHash('sha256').update(buf).digest('hex'), readback, liveness: liveness.verdict };
}

/**
 * THE ARMS. `mixRaw` is the round's own `hard` form — a straight lerp of the light's colour toward
 * a target, WITHOUT the constant-luminance normaliser. Luminance is therefore NOT preserved by the
 * hard arms, which is exactly why they are a SCREEN and not a candidate to ship: any of them that
 * reached 15 deg would still have to be re-measured at matched luminance (S59). A screen that
 * cannot reach 15 even while allowed to cheat on brightness is the stronger negative result.
 */
const PRELUDE = `
  const WARM_HARD = [1.000, 0.760, 0.480];
  const COOL_HARD = [0.480, 0.680, 1.000];
  const MOON = [0.549, 0.663, 0.847];      // sky.js:644, the night key this build already ships
  const WARM_AMB = [1.000, 0.700, 0.400];
  const mixRaw = (c, t, k) => { if (k <= 0) return; c.setRGB(c.r*(1-k)+t[0]*k, c.g*(1-k)+t[1]*k, c.b*(1-k)+t[2]*k); };
  const s = window.__scene();
`;
function arm({ key = null, keyK = 0, amb = null, ambK = 0, skyMul = 1, fillMul = 1, envMul = 1 }) {
  return `() => {
    ${PRELUDE}
    s.traverse((o) => {
      if (o === window.__sunLight) { ${key ? `mixRaw(o.color, ${key}, ${keyK});` : ''} }
      else if (o.isHemisphereLight && o.parent === s) { ${amb ? `mixRaw(o.color, ${amb}, ${ambK});` : ''} if (${skyMul} !== 1) window.__setLight(o, o.intensity * ${skyMul}); }
      else if (o.isAmbientLight && o.parent === s) { ${amb ? `mixRaw(o.color, ${amb}, ${ambK});` : ''} if (${fillMul} !== 1) window.__setLight(o, o.intensity * ${fillMul}); }
    });
    if (${envMul} !== 1) window.__envScale(${envMul});
  }`;
}
const BATTERY = [
  ['x0-control', '() => {}'],
  // the round's own `hard` set, verbatim in effect, never fired by it
  ['d1-coolhard100', arm({ amb: 'COOL_HARD', ambK: 1.0 })],
  ['d2-warmhard100', arm({ key: 'WARM_HARD', keyK: 1.0 })],
  ['d3-both100', arm({ key: 'WARM_HARD', keyK: 1.0, amb: 'COOL_HARD', ambK: 1.0 })],
  ['d4-both100-amb250', arm({ key: 'WARM_HARD', keyK: 1.0, amb: 'COOL_HARD', ambK: 1.0, skyMul: 2.5, fillMul: 2.5 })],
  ['d5-both100-amb250-env50', arm({ key: 'WARM_HARD', keyK: 1.0, amb: 'COOL_HARD', ambK: 1.0, skyMul: 2.5, fillMul: 2.5, envMul: 0.5 })],
  ['d6-both60-amb180', arm({ key: 'WARM_HARD', keyK: 0.6, amb: 'COOL_HARD', ambK: 0.6, skyMul: 1.8, fillMul: 1.8 })],
  // MINE — the night's own illuminant geometry, by day. The ruling's strongest evidence is that
  // the night reaches 22-33 deg with a hardcoded blue key; this puts that key on a day frame.
  ['x1-moonkey', arm({ key: 'MOON', keyK: 1.0 })],
  ['x2-moonkey-warmamb', arm({ key: 'MOON', keyK: 1.0, amb: 'WARM_AMB', ambK: 1.0 })],
  ['x3-moonkey-warmamb-amb400', arm({ key: 'MOON', keyK: 1.0, amb: 'WARM_AMB', ambK: 1.0, skyMul: 4, fillMul: 4 })],
  // does the hemisphere become RESOLVABLE if it is simply turned up? The round rules the term
  // "unresolvable" from an ablation taken at the intensity round 1 left it at.
  ['x4-amb400-only', arm({ skyMul: 4, fillMul: 4 })],
  ['x5-env300-only', arm({ envMul: 3.0 })],
  ['x6-warmamb-only', arm({ amb: 'WARM_AMB', ambK: 1.0 })],
  ['x0b-control-recheck', '() => {}'],
];

/**
 * `--mode matched`: THE ARM THAT DECIDES THE ROUND'S RULING, AND ITS ACCEPTANCE ARMS WITH IT.
 *
 * `x1-moonkey` — the key recoloured to `sky.js:644`'s own night blue and nothing else touched —
 * measured **17.07 deg** on the sealed pair01 crop, above `RI-VIS03`'s 15 deg minimum, which is
 * verbatim the overturn condition the round's ruling named. BUT it also dropped mean lit `Yp`
 * 0.394 -> 0.3597 and mean shadow `Yp` 0.1714 -> 0.1303, because `(0.549, 0.663, 0.847)` carries
 * Rec.709 luminance 0.6521 against `(1.000, 0.940, 0.820)`'s 0.9441. **That is hue bought with
 * brightness — the exact trade S59 was written about and the exact trade the shipped change went
 * out of its way to avoid.** So the arm is not yet an overturn; it is a question.
 *
 * This mode asks it properly: the same recolour with the key's INTENSITY scaled by 0.9441/0.6521
 * = 1.4478 so the key's luminous output is unchanged, plus the four arms S60 clause (a) needs
 * (`shadows_off` for the lit mask, `key_off`, `env_off`) measured INSIDE that configuration rather
 * than inherited from the shipped one, plus a `base` re-capture last as the run's own noise floor.
 * The frame's own mean `Yp` is reported so "matched" is a measurement and not an assertion.
 */
const KEY_SHIPPED = [1.000, 0.940, 0.820], MOONC = [0.549, 0.663, 0.847];
const LUM = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const KCOMP = +(LUM(KEY_SHIPPED) / LUM(MOONC)).toFixed(4);
const moonKeyMatched = (extra = '') => `() => {
  const s = window.__scene();
  const o = window.__sunLight;
  if (o) { o.color.setRGB(${MOONC[0]}, ${MOONC[1]}, ${MOONC[2]}); o.intensity = o.intensity * ${KCOMP}; }
  ${extra}
}`;
const MATCHED = [
  ['y0-base', '() => {}'],
  ['y1-moonkey-lummatched', moonKeyMatched()],
  ['y1-shadows_off', moonKeyMatched('window.__sunLight.shadow.intensity = 0;')],
  ['y1-key_off', moonKeyMatched('s.traverse((o) => { if (o.isDirectionalLight && o.parent === s) o.intensity = 0; });')],
  ['y1-env_off', moonKeyMatched('window.__envScale(0);')],
  // and the best of the screening arms, luminance-compensated: moon-blue key + a warm ambient at
  // 4x hemisphere/fill, which screened at 16.15 deg with `retention` 0.7132 and `C_shadow` 10.371.
  ['y2-moonkey-warmamb-amb400-lummatched', moonKeyMatched(`
    s.traverse((o) => {
      if (o.isHemisphereLight && o.parent === s) { o.color.setRGB(1.000, 0.700, 0.400); o.intensity = o.intensity * 4; }
      else if (o.isAmbientLight && o.parent === s) { o.color.setRGB(1.000, 0.700, 0.400); o.intensity = o.intensity * 4; }
    });`)],
  ['y0-base-recheck', '() => {}'],
];

const manifest = {
  at: new Date().toISOString(), mode: MODE, entry: ENTRY, served: servedSources(ENTRY),
  key_luminance_compensation: { shipped_key: KEY_SHIPPED, moon_key: MOONC, rec709: [LUM(KEY_SHIPPED), LUM(MOONC)], factor: KCOMP },
  renderer: attestation, resolution: [CW, CH], seed: SEED,
  evidence_class: attestation && attestation.class === 'HARDWARE' ? 'HARDWARE' : 'SOFTWARE — differential only (HAZARDS §15)',
  rows: [], aborted: null,
};
const reportPath = path.join(OUT, `${MODE}.json`);

try {
  const st = DECK.setups.find((x) => x.id === 'char-player');
  const where = await call('whereAmI');
  if (where.ok && where.v && where.v.interior) await call('exitInterior');
  await call('teleport', st.place.x, st.place.z);
  await call('stepFrames', 4);
  await call('setWeather', 'clear');

  if (MODE === 'matched') {
    const hour = Number(args.hour || 8);
    await call('setTimeOfDay', hour);
    const s = await call('snapshot');
    await poseAt(s.v.player.pos, st.camera);
    await call('stepFrames', SETTLE);
    for (const [id, src] of MATCHED) {
      const r = await capture(path.join(OUT, `${id}.png`), src);
      manifest.rows.push({ mode: MODE, hour, candidate: id, ...r });
      console.log(`  ${id.padEnd(24)} ${r.error ? 'ERROR ' + r.error : `${r.liveness} sun=${r.readback.sunIntensity} sunCol=${JSON.stringify(r.readback.sunColour)} env=${r.readback.environmentIntensity}`}`);
    }
  }

  if (MODE === 'weathercheck') {
    // THE PRESERVATION CLAIM THIS ROUND MADE AND NEVER CAPTURED. The shipped source comment says
    // `overcast-flat` and `storm` "ARE UNTOUCHED AT THEIR OWN WEATHER ... safe by arithmetic",
    // because `hor.lerp(neutral, overcast)` erases the edit AT FULL OVERCAST. `hemi.color` IS
    // `hor` after that lerp — `sky.js` copies it — so reading the hemisphere's colour back off the
    // live scene measures the surviving weight directly. If it is not the neutral, `(1-overcast)`
    // is not zero and the edit is not erased.
    for (const weather of String(args.weathers || 'clear,overcast,rain,storm,fog').split(',')) {
      const w = await call('setWeather', weather);
      if (!w.ok) { manifest.rows.push({ mode: MODE, weather, error: w.e }); console.log(`  ${weather}: REFUSED ${w.e}`); continue; }
      await call('setTimeOfDay', Number(args.hour || 13));
      await call('stepFrames', SETTLE);
      const rb = await g.page.evaluate(() => window.__readback());
      const r = await capture(path.join(OUT, `${weather}.png`), '() => {}');
      manifest.rows.push({ mode: MODE, weather, hour: Number(args.hour || 13), readback: rb, ...r });
      console.log(`  ${weather.padEnd(10)} hemiCol=${JSON.stringify(rb.hemiRootColour)} ambCol=${JSON.stringify(rb.ambientRootColour)} sun=${rb.sunIntensity} hemi=${rb.hemiSceneRoot}`);
    }
  }

  if (MODE === 'lights') {
    for (const hour of [8, 13, 19.5]) {
      await call('setTimeOfDay', hour);
      await call('stepFrames', SETTLE);
      const census = await g.page.evaluate(() => window.__lightCensus());
      const rb = await g.page.evaluate(() => window.__readback());
      manifest.rows.push({ mode: MODE, hour, readback: rb, census });
      console.log(`t=${hour}: ${census.length} lights; scene-root hemi=${rb.hemiSceneRoot} scene-wide hemi=${rb.hemiTotalSceneWide}`);
      for (const c of census) console.log(`   ${c.type.padEnd(18)} i=${String(c.intensity).padEnd(9)} vis=${c.chain_visible ? 'Y' : 'N'} ${c.name} < ${c.parent_chain}`);
    }
  }

  if (MODE === 'battery') {
    const hour = Number(args.hour || 8);
    await call('setTimeOfDay', hour);
    const s = await call('snapshot');
    const sp = s.v.player.pos;
    await poseAt(sp, st.camera);
    await call('stepFrames', SETTLE);
    for (const [id, src] of BATTERY) {
      const r = await capture(path.join(OUT, `${id}.png`), src);
      manifest.rows.push({ mode: MODE, hour, candidate: id, ...r });
      console.log(`  ${id.padEnd(26)} ${r.error ? 'ERROR ' + r.error : `${r.liveness} sunCol=${JSON.stringify(r.readback.sunColour)} hemiCol=${JSON.stringify(r.readback.hemiRootColour)} hemi=${r.readback.hemiSceneRoot} env=${r.readback.environmentIntensity}`}`);
    }
  }

  if (MODE === 'walk') {
    // HAZARDS §16. `setInput` is NOT a harness verb and two prior rounds photographed a stationary
    // character; displacement is measured per frame and written here so a dead path shows as data.
    for (const hour of String(args.hours || '8,13').split(',').map(Number)) {
      await call('setTimeOfDay', hour);
      await call('stepFrames', SETTLE);
      const s0 = await call('snapshot');
      const start = s0.ok ? [...s0.v.player.pos] : null;
      const wdir = path.join(OUT, `t${hour}`); fs.mkdirSync(wdir, { recursive: true });
      await poseAt(start, { yaw_deg: 180, pitch_deg: -10, distance_m: 5.0, lookHeight: 1.2 });
      for (let k = 0; k < Number(args.frames || 8); k++) {
        const script = []; for (let f = 0; f < 10; f++) script.push({ f, move: [0, 1] });
        const q = await call('queueInputs', script);
        if (!q.ok) { manifest.rows.push({ mode: 'walk', hour, k, error: q.e }); break; }
        await call('stepFrames', 10);
        const s1 = await call('snapshot');
        const p = s1.ok ? s1.v.player.pos : null;
        if (p) await poseAt(p, { yaw_deg: 180, pitch_deg: -10, distance_m: 5.0, lookHeight: 1.2 });
        const r = await capture(path.join(wdir, `f${String(k).padStart(2, '0')}.png`), '() => {}');
        const moved = (start && p) ? +Math.hypot(p[0] - start[0], p[2] - start[2]).toFixed(3) : null;
        manifest.rows.push({ mode: 'walk', hour, k, moved_m_from_start: moved, pos: p, ...r });
        console.log(`  walk t=${hour} k=${k} moved=${moved} m ${r.liveness}`);
      }
    }
  }
} catch (e) {
  manifest.aborted = String((e && e.stack) || e);
  console.error('ABORTED:', manifest.aborted);
} finally {
  // HAZARDS §18: a run that measured nothing must not overwrite a run that measured something.
  if (!manifest.rows.length && fs.existsSync(reportPath)) {
    fs.writeFileSync(reportPath.replace(/\.json$/, '.EMPTY-RUN-REFUSED.json'), JSON.stringify(manifest, null, 2));
    console.error(`REFUSED to overwrite ${reportPath} with a zero-row run (HAZARDS §18)`);
    process.exitCode = 4;
  } else {
    fs.writeFileSync(reportPath, JSON.stringify(manifest, null, 2));
    console.log(`wrote ${path.relative(REPO, reportPath)} — ${manifest.rows.length} row(s)`);
  }
  await g.close().catch(() => {});
}
