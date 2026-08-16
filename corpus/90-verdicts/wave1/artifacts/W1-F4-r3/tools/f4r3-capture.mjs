/**
 * F4 ROUND-3 BUILDER'S CAPTURE TOOL.
 *
 * WHAT IT ADDS OVER THE ROUND-2 CRITIC'S TOOL, WHICH IT IS OTHERWISE MODELLED ON.
 *
 *  1. `--mode probe` — THE ARM NO PAGE-SIDE BATTERY IN THIS PROJECT HAS EVER BEEN ABLE TO RUN.
 *     `sky.js:988` bakes the environment probe with `sunGain: R.key * max(0.05, day)`, and
 *     `noon-marsh` carries `key: 3.00`, so the probe's SUN LOBE — the warm term the probe adds on
 *     top of the blue sky — is baked at 3x. A page-side arm that scales `scene.environmentIntensity`
 *     scales the sky and the sun lobe TOGETHER, which is why the r2 critic's `x5-env300-only`
 *     measured WORSE (6.22 against a control of 7.35): it raised the warm term with the cool one.
 *     This mode imports `bakeEnvironmentProbe` into the page, rebakes the probe from the SKY'S OWN
 *     live colours with `sunGain` and `groundBounce` as free variables, and re-assigns it every
 *     frame (because `apply()` rewrites `scene.environment`). It separates the probe's two halves
 *     for the first time.
 *
 *  2. `--mode quartiles` — WHICH QUARTILE MOVED. M6 `hue_offset` is an angle between two circular
 *     means and it cannot say whether the LIT side moved, the SHADOW side moved, or both. Every arm
 *     here writes its frame; the companion analyser reports the two mean hues separately, so a
 *     lever that raises the number by making SUNLIGHT blue is distinguishable from one that raises
 *     it by making SHADOWS blue. Those are not the same change and only one of them is right.
 *
 *  3. `--mode windows` — ALL FIVE JUDGED WINDOWS, each with the S60 arms captured INSIDE the same
 *     process and the same configuration: `shadows_off` (for clause (a)'s lit mask AND clause (b)'s
 *     area, which round 2 never captured as a same-run control), `key_off`, `env_off`, and a `base`
 *     re-capture taken LAST as that run's own noise floor (S61).
 *
 *  4. `--mode budget` — `RI-VIS04` §2-D2: one ablation arm per light whose PARENT CHAIN IS VISIBLE,
 *     plus `scene.environment`, plus the base re-capture, reported on both domains (S64).
 *
 * ARMS ARE PAGE-SIDE AND PER-FRAME (`scene.onBeforeRender`), because `sky.apply()` rewrites every
 * light every frame. HAZARDS §24: `shadow.intensity` is a UNIFORM and survives a light restore, so
 * `__restore()` puts it back explicitly or it leaks into every later arm.
 *
 * DECLARED BLIND SPOT, inherited: a page-side arm on the LIGHT does not reach `uSunColour`, so it
 * does not recolour the probe's sun lobe or the sky dome's disc. `--mode probe` is the partial
 * escape from that. The whole point of round 3 is that the decisive arms are SOURCE arms; the
 * page-side modes here are screening, and every number they produce is labelled as such.
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
const MODE = String(args.mode || 'probe');
const ENTRY = String(args.entry || 'game/index.html');
const TAG = String(args.tag || MODE);
const OUT = path.resolve(REPO, args.out || `reports/f4r3/${TAG}`);
fs.mkdirSync(OUT, { recursive: true });
const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/blind/deck-protocol-a.json'), 'utf8'));
const SEED = Number(DECK.capture.seed);
const SETTLE = Number(DECK.capture.settle_frames);
const [CW, CH] = String(args.res || '1920x1080').split('x').map(Number);

/** The five judged windows, verbatim from `tools/visual/f4c-critic.mjs:65-69`. */
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

const setupOk = await g.page.evaluate(async () => {
  const R = window.__ENGINE.renderer;
  window.__scene = () => R.scene;
  window.__sky = R.sky || null;
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
  // The probe rebake. `bakeEnvironmentProbe` is a module export, not a method, so it is imported
  // rather than reached through the instance. If the import fails the mode must fail LOUDLY —
  // a silently-not-rebaked probe would read as "the lever does nothing".
  // The URL must be THE ONE THE PAGE ALREADY LOADED, discovered from the resource timeline rather
  // than guessed: importing the same file under a different URL gives a SECOND module instance with
  // a SECOND copy of three, and a DataTexture built by that copy is not the one this renderer knows.
  window.__bake = null; window.__bakeImportError = null; window.__bakeUrl = null;
  try {
    const res = performance.getEntriesByType('resource').map((r) => r.name);
    const hit = res.find((n) => /\/render\/sky\.js(\?|$)/.test(n));
    if (!hit) throw new Error(`sky.js is not in the resource timeline (${res.length} resources)`);
    window.__bakeUrl = hit;
    const mod = await import(hit);
    window.__bake = mod.bakeEnvironmentProbe || null;
    if (!window.__bake) window.__bakeImportError = 'module imported but bakeEnvironmentProbe is not exported';
  } catch (e) { window.__bakeImportError = String((e && e.message) || e); }
  /** Every light, with the chain that decides whether it can reach a pixel (RI-VIS04 §2-D2 step 1). */
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
        parent_chain: chain.slice(1).join(' < '),
      });
    });
    return rows;
  };
  /** The visible rig: exactly the lights §2-D2 permits a budget to be quoted from. */
  window.__visibleRig = () => window.__lightCensus().filter((r) => r.chain_visible && r.intensity > 0);
  window.__cfgFn = () => {};
  const prev = R.scene.onBeforeRender ? R.scene.onBeforeRender.bind(R.scene) : null;
  R.scene.onBeforeRender = function (...a) {
    if (prev) prev(...a);
    try { window.__cfgFn(); } catch (e) { window.__cfgError = String((e && e.message) || e); }
  };
  const saved = [];
  R.scene.traverse((o) => { if (o.isLight) saved.push([o, o.intensity, o.visible, o.color ? o.color.clone() : null]); });
  window.__saved = { lights: saved, envI: R.scene.environmentIntensity };
  window.__probeTex = null;
  window.__restore = () => {
    window.__cfgFn = () => {}; window.__cfgError = null;
    for (const [o, i, v, c] of window.__saved.lights) { o.intensity = i; o.visible = v; if (c && o.color) o.color.copy(c); }
    // HAZARDS §24: shadow.intensity is a UNIFORM and survives a light restore.
    if (window.__sunLight && window.__sunLight.shadow) window.__sunLight.shadow.intensity = 1;
    if (window.__probeTex) { try { window.__probeTex.dispose(); } catch (e) { /* already gone */ } window.__probeTex = null; }
    delete R.scene.__envWrote; delete R.scene.__envBase;
    R.scene.environmentIntensity = window.__saved.envI;
  };
  /**
   * Rebake the probe from the SKY'S OWN live colours with sunGain/groundBounce free. Baked ONCE per
   * arm and re-assigned every frame, because `apply()` writes `scene.environment` each frame.
   */
  window.__rebakeProbe = ({ sunGain, groundBounce, sunColour }) => {
    const sky = window.__sky;
    if (!window.__bake || !sky) return { ok: false, why: window.__bakeImportError || 'no sky instance' };
    const u = sky.uniforms;
    const sc = u.uSunColour.value.clone();
    if (sunColour) sc.setRGB(sunColour[0], sunColour[1], sunColour[2]);
    const tex = window.__bake({
      zenith: u.uZenith.value.clone(), horizon: u.uHorizon.value.clone(),
      ground: sky.hemi.groundColor.clone(), sunColour: sc,
      sunDir: u.uSunDir.value.clone(), overcast: u.uOvercast.value,
      sunGain, groundBounce,
    });
    if (window.__probeTex) { try { window.__probeTex.dispose(); } catch (e) { /* ignore */ } }
    window.__probeTex = tex;
    return {
      ok: true,
      inputs: {
        zenith: u.uZenith.value.toArray().map((v) => +v.toFixed(4)),
        horizon: u.uHorizon.value.toArray().map((v) => +v.toFixed(4)),
        ground: sky.hemi.groundColor.toArray().map((v) => +v.toFixed(4)),
        sunColour: sc.toArray().map((v) => +v.toFixed(4)),
        overcast: +Number(u.uOvercast.value).toFixed(4), sunGain, groundBounce,
      },
    };
  };
  window.__readback = () => {
    const sun = window.__sunLight;
    const sky = window.__sky;
    let hemiVis = 0, ambVis = 0, hemiAll = 0, ambAll = 0;
    let hemiCol = null, ambCol = null, sunCol = null;
    R.scene.traverse((o) => {
      const chainVisible = (() => { let p = o; while (p) { if (p.visible === false) return false; p = p.parent; } return true; })();
      if (o.isHemisphereLight) {
        hemiAll += o.intensity;
        if (chainVisible) hemiVis += o.intensity;
        if (o.parent === R.scene) { hemiCol = o.color.toArray().map((v) => +v.toFixed(4)); }
      } else if (o.isAmbientLight) {
        ambAll += o.intensity;
        if (chainVisible) ambVis += o.intensity;
        if (o.parent === R.scene) ambCol = o.color.toArray().map((v) => +v.toFixed(4));
      }
    });
    if (sun) sunCol = sun.color.toArray().map((v) => +v.toFixed(4));
    const dir = sun ? (() => { const p = sun.position, t = sun.target.position; const d = [p.x - t.x, p.y - t.y, p.z - t.z]; const L = Math.hypot(...d); return d.map((v) => +(v / L).toFixed(4)); })() : null;
    return {
      sunIntensity: sun ? +sun.intensity.toFixed(5) : null, sunColour: sunCol,
      sunDirUnit: dir, sunElevationDeg: dir ? +(Math.asin(dir[1]) * 180 / Math.PI).toFixed(3) : null,
      moonIntensity: sky && sky.moon ? +sky.moon.intensity.toFixed(5) : null,
      moonColour: sky && sky.moon ? sky.moon.color.toArray().map((v) => +v.toFixed(4)) : null,
      uSunColour: sky ? sky.uniforms.uSunColour.value.toArray().map((v) => +v.toFixed(4)) : null,
      uHorizon: sky ? sky.uniforms.uHorizon.value.toArray().map((v) => +v.toFixed(4)) : null,
      uZenith: sky ? sky.uniforms.uZenith.value.toArray().map((v) => +v.toFixed(4)) : null,
      recipeId: sky && sky.lastFrame ? (sky.lastFrame.recipeId ?? sky.lastFrame.recipe_id ?? null) : null,
      hemiVisible: +hemiVis.toFixed(5), hemiSceneWide: +hemiAll.toFixed(5), hemiRootColour: hemiCol,
      ambientVisible: +ambVis.toFixed(5), ambientSceneWide: +ambAll.toFixed(5), ambientRootColour: ambCol,
      environmentIntensity: +Number(R.scene.environmentIntensity).toFixed(5),
      hasEnvironment: !!R.scene.environment,
      probeIsMine: !!(window.__probeTex && R.scene.environment === window.__probeTex),
      shadowIntensity: sun && sun.shadow ? sun.shadow.intensity : null,
      cfgError: window.__cfgError || null,
    };
  };
  return { sun: !!window.__sunLight, sky: !!window.__sky, bake: !!window.__bake, bakeErr: window.__bakeImportError, bakeUrl: window.__bakeUrl, mapSize: window.__sunLight ? window.__sunLight.shadow.mapSize.x : null };
});
if (!setupOk.sun) { console.error('FATAL: cannot identify the sun light — every arm would be a silent no-op'); process.exit(3); }
console.log(`entry=${ENTRY} sun=ok sky=${setupOk.sky} bake=${setupOk.bake}${setupOk.bakeErr ? ' bakeErr=' + setupOk.bakeErr : ''} shadowMap=${setupOk.mapSize} renderer=${attestation.class}`);

const call = async (m, ...a) => {
  const res = await g.page.evaluate(async ({ method, callArgs }) => {
    const H = window.__HARNESS;
    if (typeof H[method] !== 'function') return { __err: `${method} IS NOT A HARNESS VERB` };
    try { return { __ok: await H[method](...callArgs) }; } catch (e) { return { __err: `${method}() threw: ${(e && e.message) || e}` }; }
  }, { method: m, callArgs: a });
  if (res && res.__err) { if (/IS NOT A HARNESS VERB/.test(res.__err)) throw new Error(res.__err); return { ok: false, e: String(res.__err).slice(0, 200) }; }
  return { ok: true, v: res ? res.__ok : undefined };
};

/**
 * The subject a deck setup names. `char-npc` resolves through `listEntities`, exactly as
 * `tools/visual/f4c-critic.mjs:175-186` does, and THROWS when there is no NPC.
 *
 * WRITTEN AFTER GETTING IT WRONG. My first version fell back to the player when `snapshot()` had no
 * `npcs` field — which it does not — so `pair03` and `pair04` silently captured the SAME FRAME as
 * `pair02` and `pair01`, differing only in which 512x512 rectangle was cropped out of it. The tell
 * was that pair02 and pair03 reported full-frame metrics identical to four decimals. A fallback that
 * quietly measures the wrong subject is worse than a crash, and both are worse than a fallback that
 * makes the substitution visible in the manifest.
 */
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
  const yaw = (yaw_deg || 0) * Math.PI / 180, pitch = (pitch_deg || 0) * Math.PI / 180;
  const d = distance_m || 0;
  const eye = [px + Math.sin(yaw) * Math.cos(pitch) * d, py + 1.5 - Math.sin(pitch) * d, pz + Math.cos(yaw) * Math.cos(pitch) * d];
  const r = await call('camera', { pos: eye, look: [px, py + lookHeight, pz] });
  if (!r.ok) throw new Error(`camera pose refused: ${r.e}`);
}

async function capture(file, cfgSrc, pre = null) {
  await g.page.evaluate(() => window.__restore());
  let preResult = null;
  // `page.evaluate(<string>)` evaluates the string as an EXPRESSION. Passing `"() => f()"` yields
  // the function object and never calls it — a silently-not-applied arm, which would have read as
  // "the lever does nothing". Call it explicitly.
  if (pre) preResult = await g.page.evaluate(`(${pre})()`);
  await g.page.evaluate(`window.__cfgFn = (${cfgSrc});`);
  await call('stepFrames', 3);
  const readback = await g.page.evaluate(() => window.__readback());
  const shot = await call('screenshot');
  if (!shot.ok) return { error: shot.e, readback, pre: preResult };
  const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(file, buf);
  const liveness = gateBuffer(buf, { label: path.basename(file), subject: false, throwOnDegenerate: false });
  return { file: path.relative(REPO, file), sha: crypto.createHash('sha256').update(buf).digest('hex'), readback, pre: preResult, liveness: liveness.verdict };
}

// ---- the arms --------------------------------------------------------------------------------

const NOOP = '() => {}';
/** Re-assign my rebaked probe every frame, because `apply()` rewrites `scene.environment`. */
const KEEP_PROBE = 'if (window.__probeTex) window.__scene().environment = window.__probeTex;';
const probeArm = ({ sunGain, groundBounce = 0.38, envMul = 1, sunColour = null }) => ({
  pre: `() => window.__rebakeProbe({ sunGain: ${sunGain}, groundBounce: ${groundBounce}, sunColour: ${sunColour ? JSON.stringify(sunColour) : 'null'} })`,
  cfg: `() => { ${KEEP_PROBE} ${envMul === 1 ? '' : `window.__envScale(${envMul});`} }`,
});

/**
 * `--mode probe`. THE HYPOTHESIS: the probe is the only resolvable ambient term (r2 measured
 * `env_off` at 4.4x the noise floor while the hemisphere and the fill sat at 1.17x and 1.10x), and
 * the probe contains a WARM sun lobe baked at `sunGain = R.key = 3.00` sitting on top of a BLUE sky.
 * If the shadow side is failing to take the sky's hue because the probe's own sun lobe is warming
 * it, then cutting `sunGain` — a change ONLY a source arm can make, which is why no round has tested
 * it — moves `hue_offset` in the physically correct direction, with the key left warm.
 *
 * `p0`/`p0b` bracket the run with the shipped configuration so the run carries its own noise floor.
 * `p1` is the identity rebake: my own bake at the SHIPPED sunGain, which must reproduce `p0` to
 * within that floor or the rebake path itself is the confound.
 */
const ALL_PROBE_ARMS = {
  'p0-control': { cfg: NOOP, pre: null },
  'p1-rebake-identity': probeArm({ sunGain: 3.0 }),
  'p2-sunlobe-0': probeArm({ sunGain: 0.0 }),
  'p3-sunlobe-0-env200': probeArm({ sunGain: 0.0, envMul: 2.0 }),
  'p4-sunlobe-0-env300': probeArm({ sunGain: 0.0, envMul: 3.0 }),
  'p5-sunlobe-0-env500': probeArm({ sunGain: 0.0, envMul: 5.0 }),
  'p6-sunlobe-050': probeArm({ sunGain: 0.5 }),
  'p7-sunlobe-0-bounce010-env300': probeArm({ sunGain: 0.0, groundBounce: 0.10, envMul: 3.0 }),
  'p0b-control-recheck': { cfg: NOOP, pre: null },
};
const PROBE_ARMS = String(args.arms || 'p0-control,p1-rebake-identity,p2-sunlobe-0,p4-sunlobe-0-env300,p0b-control-recheck')
  .split(',').map((id) => [id, ALL_PROBE_ARMS[id]]).filter(([, a]) => a);

/**
 * `--mode keyhue`. The r2 critic's decisive arm re-run by me rather than inherited, PLUS the arms
 * that separate the two ways the number can move. `MOON` is `sky.js:644`'s own night key.
 * `KCOMP` is the Rec.709 compensation so the arm cannot buy hue with brightness (S59).
 */
const KEY_SHIPPED = [1.000, 0.940, 0.820], MOONC = [0.549, 0.663, 0.847];
const LUM = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const KCOMP = +(LUM(KEY_SHIPPED) / LUM(MOONC)).toFixed(4);
const keyArm = (rgb, comp, extra = '') => `() => {
  const o = window.__sunLight;
  if (o) { o.color.setRGB(${rgb[0]}, ${rgb[1]}, ${rgb[2]}); o.intensity = o.intensity * ${comp}; }
  ${extra}
}`;
const KEYHUE_ARMS = [
  ['k0-control', { cfg: NOOP, pre: null }],
  ['k1-moonkey-lummatched', { cfg: keyArm(MOONC, KCOMP), pre: null }],
  // the same key hue with the PROBE's sun lobe recoloured to match, which is what a SOURCE change
  // does and a page-side arm does not. This is the r2 critic's declared upper-bound caveat, tested.
  ['k2-moonkey-lummatched-probe-follows', {
    cfg: `() => { ${KEEP_PROBE} (${keyArm(MOONC, KCOMP)})(); }`,
    pre: `() => window.__rebakeProbe({ sunGain: 3.0, groundBounce: 0.38, sunColour: ${JSON.stringify(MOONC)} })`,
  }],
  // and the same, with the probe's sun lobe removed instead of recoloured
  ['k3-moonkey-lummatched-sunlobe-0', {
    cfg: `() => { ${KEEP_PROBE} (${keyArm(MOONC, KCOMP)})(); }`,
    pre: `() => window.__rebakeProbe({ sunGain: 0.0, groundBounce: 0.38, sunColour: null })`,
  }],
  ['k0b-control-recheck', { cfg: NOOP, pre: null }],
];

/** `--mode budget`: RI-VIS04 §2-D2, one arm per VISIBLE light plus the probe, base recheck last. */
const BUDGET_ARMS = [
  ['b0-base', { cfg: NOOP, pre: null }],
  ['b1-key_off', { cfg: '() => { const s = window.__scene(); s.traverse((o) => { if (o.isDirectionalLight && o.parent === s) o.intensity = 0; }); }', pre: null }],
  ['b2-hemi_off', { cfg: '() => { const s = window.__scene(); s.traverse((o) => { if (o.isHemisphereLight && o.parent === s) o.intensity = 0; }); }', pre: null }],
  ['b3-fill_off', { cfg: '() => { const s = window.__scene(); s.traverse((o) => { if (o.isAmbientLight && o.parent === s) o.intensity = 0; }); }', pre: null }],
  ['b4-env_off', { cfg: '() => { window.__envScale(0); }', pre: null }],
  ['b5-shadows_off', { cfg: '() => { if (window.__sunLight) window.__sunLight.shadow.intensity = 0; }', pre: null }],
  ['b6-moon_off', { cfg: '() => { if (window.__sky && window.__sky.moon) window.__sky.moon.intensity = 0; }', pre: null }],
  ['b0b-base-recheck', { cfg: NOOP, pre: null }],
];

/**
 * `--mode windows`: the shipped tree at ALL FIVE judged windows with the acceptance arms captured
 * inside the same process. `w_base_recheck` is taken LAST so the window carries its own S61 floor.
 * S60 clause (a) needs `shadows_off` (the lit mask), `key_off` and `env_off`; clause (b) needs the
 * same-run `shadows_off` on BOTH arms, which is why it is here and not inherited.
 */
const WINDOW_ARMS = [
  ['base', NOOP],
  ['shadows_off', '() => { if (window.__sunLight) window.__sunLight.shadow.intensity = 0; }'],
  ['key_off', '() => { const s = window.__scene(); s.traverse((o) => { if (o.isDirectionalLight && o.parent === s) o.intensity = 0; }); }'],
  ['env_off', '() => { window.__envScale(0); }'],
  ['base_recheck', NOOP],
];

const manifest = {
  at: new Date().toISOString(), mode: MODE, tag: TAG, entry: ENTRY, served: servedSources(ENTRY),
  baseline_commit_pinned_by_builder: '185a5331',
  key_luminance_compensation: { shipped_key: KEY_SHIPPED, moon_key: MOONC, rec709: [LUM(KEY_SHIPPED), LUM(MOONC)], factor: KCOMP },
  renderer: attestation, resolution: [CW, CH], seed: SEED, setup: setupOk,
  evidence_class: attestation && attestation.class === 'HARDWARE' ? 'HARDWARE' : 'SOFTWARE — differential only (HAZARDS §15)',
  windows: WINDOWS, rows: [], aborted: null,
};
const reportPath = path.join(OUT, `${TAG}.json`);
/**
 * Flush after EVERY arm. A SwiftShader capture at 1920x1080 on a box at load 20 takes about a
 * minute, so a battery outlives any single foreground timeout — and a `timeout`-killed process
 * never reaches a `finally`, so a manifest written only at the end is a manifest lost. HAZARDS §18
 * still applies below: an empty run may not overwrite a full one.
 */
function flush() {
  if (!manifest.rows.length) return;
  fs.writeFileSync(reportPath, JSON.stringify(manifest, null, 2));
}

async function place(setupId) {
  const st = DECK.setups.find((x) => x.id === setupId);
  const where = await call('whereAmI');
  if (where.ok && where.v && where.v.interior) await call('exitInterior');
  await call('teleport', st.place.x, st.place.z);
  await call('stepFrames', 4);
  await call('setWeather', 'clear');
  return st;
}

try {
  if (MODE === 'lights') {
    const st = await place('char-player');
    for (const hour of String(args.hours || '8,13,19.5').split(',').map(Number)) {
      await call('setTimeOfDay', hour);
      const s = await call('snapshot');
      await poseAt(s.v.player.pos, st.camera);
      await call('stepFrames', SETTLE);
      const census = await g.page.evaluate(() => window.__lightCensus());
      const rb = await g.page.evaluate(() => window.__readback());
      manifest.rows.push({ mode: MODE, hour, readback: rb, census });
      flush();
      console.log(`t=${hour}: ${census.length} lights; visible hemi=${rb.hemiVisible} scene-wide hemi=${rb.hemiSceneWide} visible amb=${rb.ambientVisible} recipe=${rb.recipeId}`);
      for (const c of census.filter((c) => c.chain_visible && c.intensity > 0)) console.log(`   VISIBLE ${c.type.padEnd(18)} i=${String(c.intensity).padEnd(9)} col=${JSON.stringify(c.colour)} ${c.name}`);
    }
  }

  if (MODE === 'probe' || MODE === 'keyhue' || MODE === 'budget') {
    const ARMS = MODE === 'probe' ? PROBE_ARMS : MODE === 'keyhue' ? KEYHUE_ARMS : BUDGET_ARMS;
    const win = WINDOWS.find((w) => w.pair === String(args.pair || 'pair01'));
    const st = await place(win.setup);
    await call('setTimeOfDay', win.hour);
    const s = await call('snapshot');
    await poseAt(s.v.player.pos, st.camera);
    await call('stepFrames', SETTLE);
    for (const [id, a] of ARMS) {
      const r = await capture(path.join(OUT, `${id}.png`), a.cfg, a.pre);
      manifest.rows.push({ mode: MODE, pair: win.pair, hour: win.hour, crop: win.crop, arm: id, ...r });
      flush();
      const rb = r.readback || {};
      console.log(`  ${id.padEnd(30)} ${r.error ? 'ERROR ' + r.error : `${r.liveness} sunCol=${JSON.stringify(rb.sunColour)} sunI=${rb.sunIntensity} env=${rb.environmentIntensity} mine=${rb.probeIsMine} cfgErr=${rb.cfgError}`}`);
      if (r.pre && r.pre.ok === false) console.log(`     PRE FAILED: ${r.pre.why}`);
    }
  }

  if (MODE === 'windows') {
    for (const win of WINDOWS.filter((w) => !args.pair || String(args.pair).split(',').includes(w.pair))) {
      const st = await place(win.setup);
      await call('setTimeOfDay', win.hour);
      const subject = await subjectPos(st.camera.subject);
      await poseAt(subject, st.camera);
      await call('stepFrames', SETTLE);
      for (const [id, cfg] of WINDOW_ARMS) {
        const r = await capture(path.join(OUT, `${win.pair}__${id}.png`), cfg, null);
        manifest.rows.push({ mode: MODE, pair: win.pair, hour: win.hour, crop: win.crop, arm: id, ...r });
        flush();
        const rb = r.readback || {};
        console.log(`  ${win.pair} ${id.padEnd(16)} ${r.error ? 'ERROR ' + r.error : `${r.liveness} sunCol=${JSON.stringify(rb.sunColour)} sunI=${rb.sunIntensity} recipe=${rb.recipeId} shadowI=${rb.shadowIntensity}`}`);
      }
    }
  }

  if (MODE === 'orbit') {
    const st = await place('char-player');
    for (const hour of String(args.hours || '8,13').split(',').map(Number)) {
      await call('setTimeOfDay', hour);
      await call('stepFrames', 4);
      const s = await call('snapshot');
      for (const yaw of String(args.yaws || '0,60,120,180,240,300').split(',').map(Number)) {
        await poseAt(s.v.player.pos, { yaw_deg: yaw, pitch_deg: -8, distance_m: 7, lookHeight: 1.1 });
        await call('stepFrames', SETTLE);
        const rBase = await capture(path.join(OUT, `orbit-t${hour}-y${String(yaw).padStart(3, '0')}-base.png`), NOOP, null);
        const rOff = await capture(path.join(OUT, `orbit-t${hour}-y${String(yaw).padStart(3, '0')}-shadows_off.png`), WINDOW_ARMS[1][1], null);
        manifest.rows.push({ mode: MODE, hour, yaw, arm: 'base', ...rBase });
        flush();
        manifest.rows.push({ mode: MODE, hour, yaw, arm: 'shadows_off', ...rOff });
        flush();
        console.log(`  orbit t=${hour} yaw=${yaw} ${rBase.liveness}/${rOff.liveness}`);
      }
    }
  }

  if (MODE === 'weather') {
    const st = await place('char-player');
    await call('setTimeOfDay', Number(args.hour || 13));
    const s = await call('snapshot');
    await poseAt(s.v.player.pos, st.camera);
    for (const weather of String(args.weathers || 'clear,overcast,storm').split(',')) {
      const w = await call('setWeather', weather);
      if (!w.ok) { manifest.rows.push({ mode: MODE, weather, error: w.e }); console.log(`  ${weather}: REFUSED ${w.e}`); continue; }
      await call('setTimeOfDay', Number(args.hour || 13));
      await call('stepFrames', SETTLE);
      for (const [id, cfg] of [['base', NOOP], ['shadows_off', WINDOW_ARMS[1][1]], ['key_off', WINDOW_ARMS[2][1]], ['env_off', WINDOW_ARMS[3][1]]]) {
        const r = await capture(path.join(OUT, `weather-${weather}__${id}.png`), cfg, null);
        manifest.rows.push({ mode: MODE, weather, hour: Number(args.hour || 13), arm: id, ...r });
        flush();
        const rb = r.readback || {};
        console.log(`  ${weather.padEnd(10)} ${id.padEnd(14)} ${r.liveness} recipe=${rb.recipeId} hemiCol=${JSON.stringify(rb.hemiRootColour)} sunCol=${JSON.stringify(rb.sunColour)}`);
      }
    }
  }

  if (MODE === 'walk') {
    // HAZARDS §16: displacement measured per frame, so a dead input path shows up as data.
    const st = await place('char-player');
    for (const hour of String(args.hours || '8,13').split(',').map(Number)) {
      await call('setTimeOfDay', hour);
      await call('stepFrames', SETTLE);
      const s0 = await call('snapshot');
      const start = s0.ok ? [...s0.v.player.pos] : null;
      const wdir = path.join(OUT, `t${hour}`); fs.mkdirSync(wdir, { recursive: true });
      await poseAt(start, { yaw_deg: 180, pitch_deg: -10, distance_m: 5.0, lookHeight: 1.2 });
      for (let k = 0; k < Number(args.frames || 6); k++) {
        const script = []; for (let f = 0; f < 10; f++) script.push({ f, move: [0, 1] });
        const q = await call('queueInputs', script);
        if (!q.ok) { manifest.rows.push({ mode: 'walk', hour, k, error: q.e }); break; }
        await call('stepFrames', 10);
        const s1 = await call('snapshot');
        const p = s1.ok ? s1.v.player.pos : null;
        if (p) await poseAt(p, { yaw_deg: 180, pitch_deg: -10, distance_m: 5.0, lookHeight: 1.2 });
        const r = await capture(path.join(wdir, `f${String(k).padStart(2, '0')}.png`), NOOP, null);
        const moved = (start && p) ? +Math.hypot(p[0] - start[0], p[2] - start[2]).toFixed(3) : null;
        manifest.rows.push({ mode: 'walk', hour, k, moved_m_from_start: moved, pos: p, ...r });
        flush();
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
