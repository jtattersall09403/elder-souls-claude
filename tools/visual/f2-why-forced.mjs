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
 * F4's PRESERVATION WINDOWS — ruling S59: an acceptance that names only what improves has three
 * times been satisfied by something worse. These are the places F4's change can do damage that
 * the five judged windows cannot see, because every judged window is a CLEAR EXTERIOR at 08:00,
 * 13:00 or 19:30 and F4 moves numbers that reach further than that.
 *
 * Each one is here because a line of code says the change reaches it, not because it sounded
 * prudent:
 *   dusk      — `recipeForConditions()` selects `dusk-canopy` at 06:00 (dusk 1.00) and NO judged
 *               window selects it, so it would otherwise ship unmeasured.
 *   deepnight — `night-moon` at its darkest. `RI-WLD04` M17 step 6: "a frame a judge cannot
 *               classify is not a dark frame, it is a missing frame", and the recipe's own comment
 *               says a 19:30 street already measures ~6/255.
 *   overcast  — `overcast-flat`, which F4 deliberately does NOT touch. The check is that clear and
 *               overcast still order correctly after clear's ambient is cut.
 *   interior  — `renderer.js:1298` calls `sky.apply()` on EVERY frame including inside a room, and
 *               `sky.js:955` then writes `scene.environmentIntensity = R.env` from whichever
 *               EXTERIOR recipe the hour selected. So an env cut made for a marsh at noon lands on
 *               every interior in the game, and the 3x key lands there too.
 */
const PRESERVE = [
  { pair: 'prsv-dusk',      setup: 'char-player', hour: 6,  crop: [300, 150, 512, 512], weather: 'clear',    what: 'dusk-canopy — the exterior recipe no judged window selects' },
  { pair: 'prsv-deepnight', setup: 'char-player', hour: 1,  crop: [300, 150, 512, 512], weather: 'clear',    what: 'night-moon at its darkest — the readability floor' },
  { pair: 'prsv-overcast',  setup: 'char-player', hour: 13, crop: [300, 150, 512, 512], weather: 'overcast', what: 'overcast-flat — a recipe F4 does not touch; clear must not out-ambient it' },
  { pair: 'prsv-interior',  setup: 'char-player', hour: 13, crop: [300, 150, 512, 512], weather: 'clear', interior: 'archon-inn', what: 'an interior — sky.apply() writes environmentIntensity in here too' },
];
const WINDOWS = [...JUDGED, ...PRESERVE];

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
  // NOT `scene.environment = null`, for the same reason `fog_off` is not `scene.fog = null`.
  // MEASURED, F4, 2026-08-15, three times in a row on pair01: an arm that nulls the environment
  // every frame captures its OWN row fine and then the page is dead by the next arm —
  // `Target page, context or browser has been closed` out of `stepFrames`. The identical sweep
  // with `env_off` removed (`--configs shipped,key_off,shipped_recheck`) completes clean. Nulling
  // the scene environment per frame makes three.js drop and re-derive the PMREM of the probe on
  // every frame (`WebGLCubeUVMaps.onTextureDispose` — the same path `sky.js` relies on when it
  // disposes an old probe), and on SwiftShader that churn takes the page out.
  //
  // `environmentIntensity = 0` is the same optical experiment — three.js folds it into the
  // `envMapIntensity` uniform, so the probe delivers zero diffuse and zero specular — and it
  // leaves the texture and its convolution alone. `env_null` below is kept ONLY as the
  // cross-check that the two arms measure the same thing; do not put it in a long sweep.
  env_off:     `() => { __envScale(0); }`,
  env_null:    `() => { __scene().environment = null; }`,
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

  // ---- F4 (R1, the key-light rebalance) ---------------------------------------------------
  //
  // WHY `key_off` EXISTS AND `sun_off` IS NOT ENOUGH. F4's acceptance is stated as "`sun_off`
  // delta >= 2x `env_off` delta in ALL FIVE judged windows". Derived from `sky.js` at the deck's
  // own hours (`apply()` lines 778-793 and `recipeForConditions()`), pair05 is at 19:30, where
  // `elev = sin(2*pi*(19.5-6)/24) = -0.383`, so `day = 0`, `night = 1` and the recipe selected is
  // `night-moon`. There, `sun.intensity = w.sunIntensity * max(0.02, day) * R.key`
  // = 2.1 * 0.02 * 0.30 = **0.0126**, i.e. the sun is off already; the directional key at 19:30 is
  // `this.moon` (intensity `night * (0.54 + (1-overcast)*0.28)` = 0.82), and `sky.js:645` sets
  // `moon.castShadow = false`. So a literal `sun_off` arm at pair05 measures nothing and the
  // acceptance as written is UNSATISFIABLE THERE FOR A REASON THAT IS NOT ABOUT THE BALANCE.
  //
  // `key_off` is the arm the acceptance actually means: zero every directional light that is a
  // direct child of the scene root — which is exactly `sky.js`'s sun and moon, and nothing else
  // (every cell light is added to a group; see `cell_lights_off`, measured at 0.51, below noise).
  // On pairs 01-04 `key_off` and `sun_off` are the same experiment because the moon is at 0 by day.
  key_off:  `() => { const s = __scene(); s.traverse((o) => { if (o.isDirectionalLight && o.parent === s) __setLight(o, 0); }); }`,
  moon_off: `() => { const s = __scene(); s.traverse((o) => { if (o.isDirectionalLight && o.parent === s && o !== window.__sunLight) __setLight(o, 0); }); }`,

  // The three candidate rebalances, and their own `key_off`/`env_off` arms so the acceptance
  // RATIO can be computed under each candidate rather than against the shipped baseline. Each is
  // written as multipliers on the LIVE recipe value, so one arm covers `noon-marsh` (pairs 01-04)
  // and `night-moon` (pair05) without either being hard-coded.
  //
  //   r1a  key x2.2  env x0.45  sky/fill x0.80   — the conservative one
  //   r1b  key x3.0  env x0.35  sky/fill x0.75   — the one the arithmetic says clears the ratio
  //   r1c  key x2.6  env x0.40  sky/fill x1.00   — ambient LEFT ALONE, to price what it is worth
  //
  // The arithmetic these come from, using pair01's measured budget (sun 11.30 luma, probe 23.58,
  // hemisphere+fill 4.75, everything else 19.51, total 59.14): to reach key >= 2x probe the key
  // must be multiplied by at least 4.17x whatever the probe is multiplied by. `sun_x3` says the
  // key does NOT scale linearly — 3x the intensity bought +14.77 luma where linear predicts
  // +22.60, a factor of 0.65 — so the multiplier has to carry that compression too.
  ...(() => {
    // `r1n` is the NIGHT candidate and it exists because `r1b` measured 1.975 at pair05 — a miss
    // by 0.025 — while also costing 16% of the window's chroma. At night the ambient is not
    // padding: `night-moon`'s own comment says it carries the region's hue, and cutting it is what
    // makes a night unclassifiable. So r1n raises the key harder, cuts the probe harder, and
    // leaves the hemisphere and the fill exactly where they are.
    //
    // `revert_day` and `revert_night` are the DELETE-THE-FIX control, run against the LANDED
    // build: each is the exact reciprocal of the multipliers now written into `noon-marsh`
    // (x3.0 / x0.35 / x0.75) and `night-moon` (moon x3.6 / env x0.26 / ambient x1.0), so applying
    // one to the landed recipe puts the live rig back on the shipped values and the old number
    // must come back.
    //
    // ONE THING THEY CANNOT UNDO, STATED HERE RATHER THAN DISCOVERED LATER: `sky.js:944` bakes the
    // probe with `sunGain: R.key * max(0.05, day)`, so raising `noon-marsh.key` to 3.00 also
    // tripled the sun lobe INSIDE the probe texture, and no page-side arm can reach the bake.
    // `revert_day` therefore restores the lights and the probe's INTENSITY but not its content.
    // That is why it is cross-checked at pair01, where a true pre-change capture exists from
    // earlier in this session: if `revert_day` there does not come back to the real shipped
    // numbers within the noise floor, it is not a usable proxy for pair02/03/04 and must not be
    // read as one.
    const cands = {
      r1a: [2.2, 0.45, 0.80], r1b: [3.0, 0.35, 0.75], r1c: [2.6, 0.40, 1.00], r1n: [3.6, 0.26, 1.00],
      revert_day: [1 / 3.0, 1 / 0.35, 1 / 0.75], revert_night: [1 / 3.6, 1 / 0.26, 1.0],
    };
    const out = {};
    for (const [id, [K, E, C]] of Object.entries(cands)) {
      // `o.parent === s` and not a bare traverse: `R.sky`/`R.fill` in `sky.js` scale ONLY
      // `this.hemi` and `this.fill`, both added to the scene ROOT. An arm that also scaled the
      // interior's own `interior-bounced-fill` HemisphereLight (`interior.js:909`, added to the
      // interior group) would be measuring a change the recipe edit does not make — which matters
      // exactly once, at `prsv-interior`, and would have made the interior look safer than it is.
      const rig = `__sun((L, base) => { L.intensity = base * ${K}; }); __moonScale(${K}); const s = __scene(); s.traverse((o) => { if ((o.isHemisphereLight || o.isAmbientLight) && o.parent === s) __scaleLight(o, ${C}); }); __envScale(${E});`;
      out[id] = `() => { ${rig} }`;
      out[`${id}_key_off`] = { fn: `() => { ${rig} s.traverse((o) => { if (o.isDirectionalLight && o.parent === s) __setLight(o, 0); }); }`, base: id };
      out[`${id}_env_off`] = { fn: `() => { ${rig} __envScale(0); }`, base: id };
    }
    return out;
  })(),

  // THE DRIFT CONTROL, and it is not optional. Every arm of one window is captured from a sim
  // that has advanced by the arms before it — NPCs walk, foliage sways, the sky moves. So the
  // shipped configuration is captured AGAIN at the end of the sweep, from the most-advanced sim
  // state of all. `shipped_recheck` minus `shipped` is the noise floor of this whole instrument,
  // measured rather than assumed, and no arm delta smaller than it may be read as an effect.
  shipped_recheck: '() => {}',
};

/** A config is either a source string, or `{ fn, base }` where `base` names the config its delta
 * is measured against. Default base is `shipped`. Without this every candidate's `env_off` arm
 * would be differenced against the SHIPPED frame, which is not the ratio the acceptance asks for. */
const cfgFn = (name) => (typeof CONFIGS[name] === 'string' ? CONFIGS[name] : CONFIGS[name].fn);
const cfgBase = (name) => (typeof CONFIGS[name] === 'string' ? 'shipped' : (CONFIGS[name].base || 'shipped'));

// `--configs a,b,c` and `--pairs pair01,pair04` narrow the sweep. A full 16-arm x 5-window run
// is ~70 minutes on SwiftShader, so a follow-up that only needs four arms should cost four arms.
const ONLY_CFG = args.configs ? String(args.configs).split(',').map((s) => s.trim()).filter(Boolean) : null;
const ONLY_PAIR = args.pairs ? String(args.pairs).split(',').map((s) => s.trim()).filter(Boolean) : null;
if (ONLY_CFG) {
  const unknown = ONLY_CFG.filter((k) => !CONFIGS[k]);
  if (unknown.length) { console.error(`unknown config(s): ${unknown.join(', ')}. have: ${Object.keys(CONFIGS).join(', ')}`); process.exit(2); }
  // A narrowed run that drops an arm's delta BASE silently produces `delta_vs_shipped: null` for
  // that arm — a hole where the acceptance number should be. Pull the bases back in rather than
  // leaving the reader to notice.
  for (const k of [...ONLY_CFG]) { const b = cfgBase(k); if (!ONLY_CFG.includes(b)) ONLY_CFG.push(b); }
}
const ORDER = Object.keys(CONFIGS).filter((k) => !ONLY_CFG || ONLY_CFG.includes(k));

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
  // The moon is the directional key at night (`sky.js:644` — added to the scene root, and
  // `castShadow = false`). A candidate that raises "the key" has to raise it too, or the arm is a
  // daylight-only experiment wearing an all-hours name.
  window.__moonScale = (k) => {
    const s = R.scene;
    s.traverse((o) => { if (o.isDirectionalLight && o.parent === s && o !== window.__sunLight) window.__scaleLight(o, k); });
  };
  // Same recover-the-recipe-value trick as `__lightBase`: `sky.apply()` writes
  // `scene.environmentIntensity = R.env` every frame before this enforcer runs, so whenever the
  // live value differs from what this enforcer last wrote, that live value IS the recipe's. Without
  // this a multiplying env arm compounds to k^n after n frames, which is the exact confound that
  // made the first version of this tool report `sun_x3` as darker than `indirect_off`.
  window.__envScale = (k) => {
    const s = R.scene;
    if (s.__f2envWrote === undefined || s.__f2envWrote !== s.environmentIntensity) s.__f2envBase = s.environmentIntensity;
    s.environmentIntensity = s.__f2envBase * k;
    s.__f2envWrote = s.environmentIntensity;
  };
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
    delete R.scene.__f2envWrote; delete R.scene.__f2envBase;
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
// WHY THIS RUN CANNOT BE ALLOWED TO DIE WITHOUT WRITING. The diagnosis run that commissioned F4
// lost pair03/04/05 entirely to `Target page, context or browser has been closed` thrown out of
// `call()`, and because `forced.json` is written only after the loops, EVERY row it had already
// captured was lost with it and had to be recomputed from PNGs by hand. This build records the
// death as data and writes what it has.
let aborted = null;
for (const cfgName of ORDER) fs.mkdirSync(path.join(OUT, cfgName), { recursive: true });
const sweep = async () => {
// WINDOW OUTER, CONFIG INNER. The first version of this loop had config outer and re-teleported
// for all 60 rows; province streaming after a teleport dominates the run and it was ~2 minutes
// per row. The place, the hour and the camera pose are identical across every arm of one window
// by construction, so they are set ONCE and only the forced configuration changes inside — which
// is also a stronger experiment: no arm can differ from another by a re-streamed world.
for (const jw of WINDOWS.filter((j) => !ONLY_PAIR || ONLY_PAIR.includes(j.pair))) {
  const setup = DECK.setups.find((s) => s.id === jw.setup);
  const where = await call('whereAmI');
  if (where.ok && where.v && where.v.interior) await call('exitInterior');
  await call('teleport', setup.place.x, setup.place.z);
  await call('stepFrames', 4);
  await call('setWeather', jw.weather || 'clear');
  await call('setTimeOfDay', jw.hour);
  // ENTER FIRST, POSE SECOND, AND THE ORDER IS THE WHOLE POINT. Posing before entering put the
  // camera at the player's EXTERIOR position and left it there while the player moved into the
  // interior cell: the first `prsv-interior` capture came back mean 191.99, sd 5.28, and
  // BYTE-IDENTICAL crop statistics under two different lighting configurations — a photograph of
  // the sky with `archon-inn` written in the corner. `frame-liveness` passed it, because a smooth
  // sky gradient is a perfectly live image; it is just not an image of a room. HAZARDS §15's
  // second liveness question — "is the thing I am measuring in it" — and it was caught by opening
  // the frame, not by a statistic.
  let perr = null;
  if (jw.interior) {
    const ent = await call('enterInterior', jw.interior);
    await call('stepFrames', 4);
    const w2 = await call('whereAmI');
    const inside = !!(w2.ok && w2.v && w2.v.interior);
    if (!inside) perr = `NOT INSIDE '${jw.interior}': enterInterior ${ent.ok ? 'returned ' + JSON.stringify(ent.v).slice(0, 120) : 'failed: ' + ent.e}`;
  }
  perr = [perr, await poseCamera(setup)].filter(Boolean).join('; ') || null;
  await call('stepFrames', SETTLE);
  for (const cfgName of ORDER) {
    const dir = path.join(OUT, cfgName);
    // restore, then INSTALL this arm's forced configuration as the per-frame enforcer
    await g.page.evaluate(() => window.__restore());
    await g.page.evaluate(`window.__cfgFn = (${cfgFn(cfgName)});`);
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
      pose_error: perr, weather: jw.weather || 'clear', interior: jw.interior || null, frame: path.relative(REPO, file), crop_file: path.relative(REPO, cropFile),
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
};
try { await sweep(); }
catch (e) {
  aborted = { at_row: rows.length, error: String((e && e.message) || e).slice(0, 300) };
  console.error(`\nSWEEP ABORTED after ${rows.length} row(s): ${aborted.error}`);
  console.error('Rows captured before the abort are still written below — read `aborted` in forced.json.');
}

// deltas against each arm's declared base config, per judged window (default base: `shipped`)
const byCfgPair = new Map(rows.filter((r) => r._raw).map((r) => [`${r.config}|${r.pair}`, r._raw]));
for (const r of rows) {
  if (!r._raw) continue;
  const baseName = cfgBase(r.config);
  const base = byCfgPair.get(`${baseName}|${r.pair}`);
  r.delta_base = baseName;
  r.delta_vs_shipped = base ? { mean_abs_rgb: meanAbsDelta(r._raw, base) } : null;
  delete r._raw;
}

// The F4 acceptance, computed rather than left to a reader: per candidate, per window,
// key_off delta / env_off delta, and the >= 2.0 verdict.
const RATIO = {};
for (const jw of WINDOWS) {
  for (const fam of ['', ...Object.keys(CONFIGS)].filter((k) => k.endsWith('_key_off') || k === '')) {
    const id = fam === '' ? 'shipped' : fam.replace(/_key_off$/, '');
    const k = rows.find((r) => r.pair === jw.pair && r.config === (fam === '' ? 'key_off' : fam));
    const e = rows.find((r) => r.pair === jw.pair && r.config === (fam === '' ? 'env_off' : `${id}_env_off`));
    if (!k || !e || !k.delta_vs_shipped || !e.delta_vs_shipped) continue;
    const kd = k.delta_vs_shipped.mean_abs_rgb, ed = e.delta_vs_shipped.mean_abs_rgb;
    const bl = rows.find((r) => r.pair === jw.pair && r.config === id);
    const sh = rows.find((r) => r.pair === jw.pair && r.config === 'shipped');
    (RATIO[id] ||= {})[jw.pair] = {
      key_off_delta: kd, env_off_delta: ed, ratio: +(kd / ed).toFixed(3),
      passes_2x: kd >= 2 * ed,
      mean_luma: bl ? bl.stats.mean_luma : null,
      luma_vs_shipped: (bl && sh) ? +(bl.stats.mean_luma / sh.stats.mean_luma).toFixed(4) : null,
      sd_vs_shipped: (bl && sh) ? +(bl.stats.sd_luma / sh.stats.sd_luma).toFixed(4) : null,
      chroma_vs_shipped: (bl && sh) ? +(bl.stats.mean_chroma / sh.stats.mean_chroma).toFixed(4) : null,
    };
  }
}
console.log('\n--- F4 acceptance: key_off delta must be >= 2.0x env_off delta, in every judged window ---');
for (const [id, byPair] of Object.entries(RATIO)) {
  for (const [pair, v] of Object.entries(byPair)) {
    console.log(`  ${id.padEnd(6)} ${pair}  key=${String(v.key_off_delta).padStart(8)} env=${String(v.env_off_delta).padStart(8)} ratio=${String(v.ratio).padStart(7)} ${v.passes_2x ? 'PASS' : 'fail'}   luma=${v.luma_vs_shipped}x sd=${v.sd_vs_shipped}x chroma=${v.chroma_vs_shipped}x of shipped`);
  }
}

const out = {
  at: new Date().toISOString(),
  what_this_is: 'F2/F1 diagnosis: the five judged Protocol A r2 windows re-rendered under forced render configurations. Crop boxes copied verbatim from the sealed pairing key.',
  renderer: attestation,
  evidence_class: attestation && attestation.class === 'HARDWARE' ? 'HARDWARE' : 'SOFTWARE — differential only, not an absolute appearance claim (HAZARDS §15)',
  configs: Object.fromEntries(Object.keys(CONFIGS).map((k) => [k, { fn: cfgFn(k), delta_base: cfgBase(k) }])),
  judged_windows: JUDGED.map(({ pair, setup, hour, crop, what }) => ({ pair, setup, hour, crop, what })),
  preservation_windows: PRESERVE.map(({ pair, setup, hour, crop, what, weather, interior }) => ({ pair, setup, hour, crop, what, weather: weather || 'clear', interior: interior || null })),
  f4_acceptance: { rule: 'key_off mean|d|rgb >= 2.0 x env_off mean|d|rgb, in ALL FIVE judged windows', by_config: RATIO },
  aborted,
  rows,
};
fs.writeFileSync(path.join(OUT, 'forced.json'), JSON.stringify(out, null, 2));
console.log(`\nwrote ${path.join(OUT, 'forced.json')}`);
try { await g.close(); } catch { /* the browser is already gone; that is what `aborted` records */ }
process.exit(aborted ? 4 : 0);
