// Deterministic sky, sun, shadow and atmosphere — the whole of `setTimeOfDay` / `setWeather`'s
// visible effect.
//
// HARNESS.md §6: screenshots are only comparable if the clock and the weather are pinned,
// so both are pure functions of (hours, weatherId) with no wall clock and no randomness
// anywhere. Two runs that ask for 21:00 in a storm get the identical sky, which is what
// makes the twelve canonical viewpoints comparable across waves.
//
// ---------------------------------------------------------------------------------------------
// W1-30B, 2026-08-14. What changed and why, in one place, because three of the ten defects in
// `orchestration/plans/W1-30.md` were all in this file.
//
//  A. THE AIR. `FogExp2` transmits `exp(-(density*d)^2)` — a Gaussian, not Beer-Lambert — and the
//     code fed it `regions.json`'s `extinction_per_m`, which declares itself to be a Beer-Lambert
//     coefficient, PLUS `1.978 / sightline_m`. Measured on the shipped build at the Lilmoth
//     approach, removing fog entirely changes **67% of the pixels in the frame**: the settlement
//     is a grey ghost at 40 m and the hill behind it is white paper. Every other improvement in
//     the visual tree was invisible past 40 m until this changed. The air is now genuinely
//     Beer-Lambert, genuinely height-dependent, and its coefficient is passed through a monotone
//     compression that preserves the thirteen regions' ORDER while keeping clear air honest.
//
//  B. THE SHADOWS. Measured, not read: the shadow sabotage moves 13.0% of pixels at the spawn and
//     0.60% on the Lilmoth approach. So shadows were drawing — near the player — and stopping dead
//     at the edge of a 120 m box centred on the player's feet. Every vista and every approach, the
//     shots a player judges a world by, had no shadow structure at all. The shadow volume is now
//     fitted to the CAMERA's frustum out to a declared shadow distance, stabilised by a bounding
//     sphere so it does not change size as the camera turns, and texel-snapped in light space.
//
//  C. THE IMAGE-BASED LIGHTING. `new Uint8Array(16 * 8 * 4)` is 128 texels, and three.js caches the
//     PMREM convolution of a non-render-target texture FOREVER (`WebGLCubeUVMaps.get`: it only
//     re-converts when `texture.isRenderTargetTexture`). So the old environment was not merely
//     low-resolution, it was **generated once at boot and never updated again** — rewriting its
//     bytes every frame changed nothing a material could see. It is now a half-float equirectangular
//     radiance map, regenerated on a time/weather/region bucket change and REPLACED (old texture
//     disposed) so the convolution is rebuilt, giving every `MeshStandardMaterial` a real
//     roughness-convolved mip chain for the first time.
//
// Preserved deliberately: one authoritative sun/moon direction shared by dome, fog, light and
// shadow; texel snapping; deterministic bounded precipitation driven by simulation frame; the moon
// as the exact inverse of the celestial direction; the closed `WEATHER` vocabulary.
// ---------------------------------------------------------------------------------------------
'use strict';

import * as THREE from '../../vendor/three/three.module.js';
// W1-30S seam: renderer.js pushes this frame's lighting summary through
// `renderer.setLightingFrame(obj)`.
import { buildLightingFrame } from './lighting.js';
// W1-30B: the named light rigs. `sky.js` is the first of the registry's two consumers — it selects
// a recipe every frame and scales the live rig by it. The second is `environmentProbeSpec()`
// below, which bakes the IBL probe from the same recipe in a different context.
import { lightingRecipe, recipeForConditions } from './lib/lighting-recipes.js';

const hash1=(n)=>{let h=Math.imul(n|0,0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);return((h^(h>>>16))>>>0)/4294967295;};

/** The named weather states. Closed set — `setWeather` throws on anything else. */
export const WEATHER = {
  clear: { fogDensity: 0.0026, sunIntensity: 2.1, ambient: 0.62, tint: [1.00, 1.00, 1.00], overcast: 0.00, rain: 0.0 },
  overcast: { fogDensity: 0.0062, sunIntensity: 0.7, ambient: 0.95, tint: [0.86, 0.88, 0.92], overcast: 0.80, rain: 0.0 },
  rain: { fogDensity: 0.0112, sunIntensity: 0.45, ambient: 0.85, tint: [0.72, 0.78, 0.84], overcast: 0.92, rain: 0.6 },
  storm: { fogDensity: 0.0180, sunIntensity: 0.28, ambient: 0.62, tint: [0.55, 0.62, 0.72], overcast: 1.00, rain: 1.0 },
  fog: { fogDensity: 0.0320, sunIntensity: 0.65, ambient: 1.05, tint: [0.80, 0.82, 0.80], overcast: 0.70, rain: 0.0 },
  // Regional states (W1-01). RI-WLD04 makes the weather STATE SET one of the nine axes, so the
  // vocabulary has to be bigger than five: a region whose only weather is "clear or storm" cannot
  // differ from twelve others on this axis. W1-02 owns the transition machine; these are the
  // named states it will transition between, and setWeather() stays a closed set.
  cold_rain:    { fogDensity: 0.0098, sunIntensity: 0.40, ambient: 0.80, tint: [0.70, 0.78, 0.90], overcast: 0.90, rain: 0.7 },
  warm_rain:    { fogDensity: 0.0125, sunIntensity: 0.55, ambient: 0.95, tint: [0.82, 0.86, 0.74], overcast: 0.82, rain: 0.6 },
  // Dense canopy rain stays sombre, but must retain bark/leaf value separation in motion.  The
  // previous 0.32/0.78 pair collapsed every material below the canopy into one near-black mass.
  heavy_rain:   { fogDensity: 0.0145, sunIntensity: 0.46, ambient: 0.96, tint: [0.70, 0.80, 0.72], overcast: 0.94, rain: 1.0 },
  dawn_mist:    { fogDensity: 0.0280, sunIntensity: 0.80, ambient: 1.00, tint: [0.90, 0.92, 0.86], overcast: 0.45, rain: 0.0 },
  sea_fog:      { fogDensity: 0.0360, sunIntensity: 0.60, ambient: 1.05, tint: [0.84, 0.88, 0.92], overcast: 0.62, rain: 0.0 },
  sea_squall:   { fogDensity: 0.0210, sunIntensity: 0.30, ambient: 0.66, tint: [0.62, 0.68, 0.76], overcast: 1.00, rain: 0.9 },
  fever_fog:    { fogDensity: 0.0420, sunIntensity: 0.45, ambient: 0.90, tint: [0.62, 0.86, 0.60], overcast: 0.75, rain: 0.1 },
  salt_storm:   { fogDensity: 0.0520, sunIntensity: 0.34, ambient: 1.10, tint: [1.00, 0.98, 0.90], overcast: 0.88, rain: 0.0 },
  ashfall:      { fogDensity: 0.0190, sunIntensity: 0.42, ambient: 0.72, tint: [0.72, 0.70, 0.64], overcast: 0.86, rain: 0.0 },
  dust_devil:   { fogDensity: 0.0090, sunIntensity: 1.50, ambient: 0.70, tint: [1.00, 0.86, 0.66], overcast: 0.10, rain: 0.0 },
  heat_shimmer: { fogDensity: 0.0040, sunIntensity: 2.30, ambient: 0.66, tint: [1.00, 0.92, 0.78], overcast: 0.00, rain: 0.0 },
  dry_thunder:  { fogDensity: 0.0068, sunIntensity: 0.90, ambient: 0.74, tint: [0.86, 0.86, 0.90], overcast: 0.55, rain: 0.0 },
  still:        { fogDensity: 0.0058, sunIntensity: 1.20, ambient: 0.98, tint: [1.00, 0.97, 0.86], overcast: 0.18, rain: 0.0 },
  // W1-02. `RI-WLD08` §5 names a four-state machine for each of the thirteen regions and no two
  // regions may share a full state set; twenty-five of the forty-one states it names had no entry
  // here, so `setWeather('thick_fog')` threw and `game/data/world/weather.json` could not have
  // been rendered even if something had been reading it. `tint` is the state's own colour cast and
  // `overcast` its light class — `sun` states sit at or below 0.20, `overcast` around 0.55-0.85,
  // `dark` at 0.86 and above, matching the `light` field the stealth model reads so the two halves
  // of the build cannot disagree about whether it is a bright day.
  humid_clear:     { fogDensity: 0.0072, sunIntensity: 1.90, ambient: 0.86, tint: [0.97, 1.00, 0.92], overcast: 0.08, rain: 0.0 },
  night_bloom:     { fogDensity: 0.0110, sunIntensity: 0.55, ambient: 1.15, tint: [0.66, 1.00, 0.86], overcast: 0.20, rain: 0.0 },
  canopy_dim:      { fogDensity: 0.0140, sunIntensity: 0.50, ambient: 0.70, tint: [0.72, 0.82, 0.70], overcast: 0.72, rain: 0.0 },
  steam:           { fogDensity: 0.0300, sunIntensity: 0.58, ambient: 1.02, tint: [0.86, 0.92, 0.84], overcast: 0.66, rain: 0.0 },
  downpour:        { fogDensity: 0.0250, sunIntensity: 0.26, ambient: 0.70, tint: [0.60, 0.70, 0.64], overcast: 0.98, rain: 1.0 },
  queen_agitation: { fogDensity: 0.0064, sunIntensity: 1.70, ambient: 0.92, tint: [1.00, 0.90, 0.62], overcast: 0.14, rain: 0.0 },
  comb_swelter:    { fogDensity: 0.0080, sunIntensity: 1.95, ambient: 0.90, tint: [1.00, 0.94, 0.70], overcast: 0.10, rain: 0.0 },
  drone_haze:      { fogDensity: 0.0130, sunIntensity: 0.85, ambient: 0.94, tint: [0.96, 0.90, 0.72], overcast: 0.58, rain: 0.0 },
  gale:            { fogDensity: 0.0190, sunIntensity: 0.30, ambient: 0.64, tint: [0.62, 0.70, 0.78], overcast: 0.96, rain: 0.5 },
  high_clear:      { fogDensity: 0.0016, sunIntensity: 2.45, ambient: 0.58, tint: [0.98, 0.99, 1.00], overcast: 0.00, rain: 0.0 },
  hail:            { fogDensity: 0.0215, sunIntensity: 0.30, ambient: 0.72, tint: [0.78, 0.84, 0.92], overcast: 0.94, rain: 0.8 },
  hill_mist:       { fogDensity: 0.0355, sunIntensity: 0.62, ambient: 1.06, tint: [0.88, 0.90, 0.92], overcast: 0.64, rain: 0.0 },
  sleet:           { fogDensity: 0.0205, sunIntensity: 0.33, ambient: 0.70, tint: [0.74, 0.80, 0.90], overcast: 0.92, rain: 0.7 },
  cloud_below:     { fogDensity: 0.0020, sunIntensity: 2.35, ambient: 0.74, tint: [1.00, 0.98, 0.96], overcast: 0.04, rain: 0.0 },
  rockfall_wind:   { fogDensity: 0.0105, sunIntensity: 0.95, ambient: 0.76, tint: [0.86, 0.84, 0.82], overcast: 0.52, rain: 0.0 },
  ash_storm:       { fogDensity: 0.0560, sunIntensity: 0.24, ambient: 0.68, tint: [0.62, 0.58, 0.54], overcast: 0.98, rain: 0.0 },
  drizzle:         { fogDensity: 0.0116, sunIntensity: 0.60, ambient: 0.90, tint: [0.80, 0.84, 0.84], overcast: 0.76, rain: 0.4 },
  dry_heat:        { fogDensity: 0.0046, sunIntensity: 2.25, ambient: 0.64, tint: [1.00, 0.94, 0.76], overcast: 0.02, rain: 0.0 },
  haze:            { fogDensity: 0.0148, sunIntensity: 0.90, ambient: 0.96, tint: [0.94, 0.90, 0.80], overcast: 0.56, rain: 0.0 },
  night_cold:      { fogDensity: 0.0090, sunIntensity: 0.36, ambient: 0.60, tint: [0.68, 0.74, 0.90], overcast: 0.88, rain: 0.0 },
  red_haze:        { fogDensity: 0.0175, sunIntensity: 0.72, ambient: 0.92, tint: [1.00, 0.66, 0.58], overcast: 0.60, rain: 0.0 },
  black_clear:     { fogDensity: 0.0100, sunIntensity: 0.30, ambient: 0.58, tint: [0.58, 0.66, 0.70], overcast: 0.86, rain: 0.0 },
  thick_fog:       { fogDensity: 0.0850, sunIntensity: 0.40, ambient: 1.10, tint: [0.78, 0.82, 0.80], overcast: 0.80, rain: 0.0 },
  white_clear:     { fogDensity: 0.0018, sunIntensity: 2.50, ambient: 0.60, tint: [1.00, 1.00, 0.98], overcast: 0.00, rain: 0.0 },
  night_freeze:    { fogDensity: 0.0086, sunIntensity: 0.30, ambient: 0.56, tint: [0.72, 0.80, 0.96], overcast: 0.90, rain: 0.0 },
};

// =============================================================================================
// THE ATMOSPHERE MODEL
// =============================================================================================
//
// WHY THIS IS A SHADER-CHUNK OVERRIDE AND NOT A POST PASS. `render/post/**` and `renderer.js`
// belong to W1-30A (ruling O1). A depth-reconstructing full-screen atmosphere pass is A's to write
// and B publishes its parameters on the lighting frame for it. What B owns is `scene.fog`, and
// `scene.fog` is applied inside every material's fragment shader through four `THREE.ShaderChunk`
// entries. Replacing those four strings changes the fog MODEL for the whole build without touching
// one line of anyone else's file, and it is per-pixel, correctly occluded and free of a second
// depth pass. The cost is that it is a global mutation of the three.js chunk registry, so it is
// done once, from one named function, with the stock strings kept for `restoreStockAtmosphere()`.
//
// WHAT THE MODEL IS. Transmittance along the view ray, with the air thinning exponentially with
// height:
//
//     sigma(y) = sigma0 * exp(-y / H)
//     tau      = integral of sigma(y) ds from the eye to the fragment
//     colour   = mix(colour, fogColour, 1 - exp(-tau))
//
// For a straight ray from eye height `yc` to fragment height `yf` over path length `d` the
// integral has a closed form and needs no marching:
//
//     tau = sigma0 * d * exp(-yc/H) * (exp(-(yf-yc)/H) - 1) / (-(yf-yc)/H)
//
// which degenerates correctly to `sigma0 * d * exp(-yc/H)` as (yf - yc) -> 0. `H <= 0` means "no
// height dependence" and falls back to plain Beer-Lambert, which is the null control the plan's
// "atmosphere has height" row asks for.
//
// HOW THE PARAMETERS REACH THE SHADER WITHOUT NEW UNIFORMS. three.js refreshes exactly four fog
// uniforms per material per frame (`WebGLMaterials.refreshFogUniforms`), and which ones depends on
// the fog object's type: `isFog` gets `fogColor`, `fogNear` and `fogFar`; `isFogExp2` gets
// `fogColor` and `fogDensity`. Adding a fifth uniform to `UniformsLib.fog` does not work, because
// `WebGLPrograms.getUniforms` CLONES the uniform objects per material, so nothing written to the
// library ever reaches a shader. So `HeightFog` extends `Fog` — `isFog` is true, both floats are
// refreshed — and the two floats are repurposed:
//
//     fogNear  ->  sigma0, the ground-level extinction coefficient, per metre
//     fogFar   ->  H, the height falloff in metres (<= 0 disables the height term)
//
// The eye height comes from `cameraPosition`, which three declares in every fragment prefix, and
// the fragment's world height is computed in `fog_vertex` from `mvPosition` and the view matrix's
// second row — no matrix inverse, and it is correct for skinned, instanced and batched geometry
// because `mvPosition` is post-`project_vertex` in all ten stock shaders that include the chunk.
// The one shader that does not include `project_vertex` — the sprite shader — defines `mvPosition`
// itself, so the variable is in scope in all of them.

const STOCK_FOG_CHUNKS = {
  fog_vertex: THREE.ShaderChunk.fog_vertex,
  fog_pars_vertex: THREE.ShaderChunk.fog_pars_vertex,
  fog_fragment: THREE.ShaderChunk.fog_fragment,
  fog_pars_fragment: THREE.ShaderChunk.fog_pars_fragment,
};

const ES_FOG_PARS_VERTEX = `#ifdef USE_FOG
  varying float vFogDepth;
  varying float vFogWorldY;
#endif`;

const ES_FOG_VERTEX = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  // world Y without inverting the view matrix: for a rigid view transform V = [R|t],
  // world = R^T * view + cameraPosition, and (R^T v).y = dot(vec3(V[0].y, V[1].y, V[2].y), v).
  vFogWorldY = dot( vec3( viewMatrix[ 0 ].y, viewMatrix[ 1 ].y, viewMatrix[ 2 ].y ), mvPosition.xyz ) + cameraPosition.y;
#endif`;

const ES_FOG_PARS_FRAGMENT = `#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform float fogNear;  // W1-30B: sigma0, ground-level extinction per metre
  uniform float fogFar;   // W1-30B: H, height falloff in metres; <= 0 means height-independent
  varying float vFogDepth;
  varying float vFogWorldY;
#endif`;

const ES_FOG_FRAGMENT = `#ifdef USE_FOG
  float esSigma0 = fogNear;
  float esH = fogFar;
  float esDist = max( vFogDepth, 0.0 );
  float esTau;
  if ( esH <= 0.0 ) {
    esTau = esSigma0 * esDist;
  } else {
    float esYc = cameraPosition.y;
    float esDy = vFogWorldY - esYc;
    float esA = exp( - esYc / esH );
    float esT = - esDy / esH;
    // (exp(t) - 1) / t, expanded near t = 0 so a level ray does not divide by zero
    float esRatio = ( abs( esT ) < 1e-3 ) ? ( 1.0 + 0.5 * esT ) : ( ( exp( esT ) - 1.0 ) / esT );
    esTau = esSigma0 * esDist * esA * esRatio;
  }
  float fogFactor = 1.0 - exp( - max( esTau, 0.0 ) );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, clamp( fogFactor, 0.0, 1.0 ) );
#endif`;

let ATMOSPHERE_INSTALLED = false;

/** Install the height-fog / Beer-Lambert model into three's shader chunk registry. Idempotent. */
export function installAtmosphereModel() {
  if (ATMOSPHERE_INSTALLED) return false;
  THREE.ShaderChunk.fog_pars_vertex = ES_FOG_PARS_VERTEX;
  THREE.ShaderChunk.fog_vertex = ES_FOG_VERTEX;
  THREE.ShaderChunk.fog_pars_fragment = ES_FOG_PARS_FRAGMENT;
  THREE.ShaderChunk.fog_fragment = ES_FOG_FRAGMENT;
  ATMOSPHERE_INSTALLED = true;
  return true;
}

/**
 * Put three's stock `FogExp2` chunks back. This is the source-level null control for the whole
 * atmosphere change and it exists so the control can be executed without editing this file: call
 * it before the first material compiles and the build behaves exactly as it did before W1-30B.
 */
export function restoreStockAtmosphere() {
  if (!ATMOSPHERE_INSTALLED) return false;
  Object.assign(THREE.ShaderChunk, STOCK_FOG_CHUNKS);
  ATMOSPHERE_INSTALLED = false;
  return true;
}

export function atmosphereModelInstalled() { return ATMOSPHERE_INSTALLED; }

installAtmosphereModel();

/**
 * The scene's air. `isFog` is true so three refreshes `fogNear`/`fogFar` every frame; those two
 * carry `sigma0` and `heightFalloff` into the shader (see the block above).
 *
 * `density` is kept as an alias of `sigma0` — and it is an alias in BOTH directions — because it is
 * the accessor `render/visual-foundation.js` declares as the atmosphere sabotage surface, and
 * because three harness tools (`vt-world.mjs`, `vt-playmode.mjs`, `vt-seethrough.mjs`) pin
 * `scene.fog.density` to 0 with `Object.defineProperty` to take fog out of a measurement. An own
 * property defined on the instance shadows this prototype accessor, and `near` reads through
 * `this.density`, so those tools keep working unchanged and keep meaning what they meant.
 */
export class HeightFog extends THREE.Fog {
  constructor(colour, sigma0 = 0.003, heightFalloff = 0) {
    super(colour, sigma0, heightFalloff);
    this.sigma0 = sigma0;
    this.heightFalloff = heightFalloff;
  }
  get density() { return this.sigma0; }
  set density(v) { this.sigma0 = v; }
  get near() { return this.density; }
  set near(v) { this.density = v; }
  get far() { return this.heightFalloff; }
  set far(v) { this.heightFalloff = v; }
}

// ---- the air's numbers ------------------------------------------------------------------------

/**
 * The extinction that leaves 35% of an object's contrast against the sky at 150 m under
 * Beer-Lambert: `exp(-sigma * 150) = 0.35` gives `sigma = 0.00700`. Rounded down to 0.0068 for
 * margin. This is the plan's "the world is visible" row expressed as the one number that decides
 * it, so a critic can check the row by checking this constant and the compression below.
 */
export const CLEAR_AIR_CEILING = 0.0068;

/**
 * The weather's own extinction, converted from the authored `fogDensity`.
 *
 * `WEATHER[].fogDensity` was authored against three's Gaussian `FogExp2`. Converting it by matching
 * the 2%-visibility point makes near-field air far too thick (rain would halve a silhouette at
 * 60 m), so the conversion matches the HALF-transmittance distance instead, which is where a
 * viewer actually reads the change: `FogExp2` is at 50% at `sqrt(ln 2)/d`, Beer-Lambert at
 * `ln 2 / sigma`, so `sigma = d * ln2 / sqrt(ln2) = 0.8326 * d`.
 */
const WEATHER_SIGMA = (w) => 0.8326 * w.fogDensity;

/**
 * How thick the air is ALLOWED to get, as a multiple of the weather's own extinction. Clear weather
 * is held at `CLEAR_AIR_CEILING` so every region's clear-air vista passes the 150 m row; a state
 * that is supposed to close the world in — `thick_fog`, `ash_storm`, `sea_fog`, `storm` — raises
 * its own ceiling and does close it in. This is the single knob that trades "the marsh is readable
 * in rain" against "rain in a marsh means something": raise it and rain reads thinner.
 */
const WEATHER_CEILING_K = 2.2;

/**
 * Region + weather -> the air's ground-level extinction, per metre.
 *
 * The two coefficients ADD, because that is what extinction coefficients do, and the earlier
 * `Math.max()` version let the region term win in four of thirteen regions so weather changed the
 * frame by nothing there (W1-02's consumption probe caught it). The SUM is then passed through a
 * monotone saturating compression toward the ceiling:
 *
 *     sigma = C * (1 - exp(-(sigmaRegion + sigmaWeather) / C))
 *
 * which is strictly increasing, so Blackwood is still the thickest air in the province and the Salt
 * Hills still the clearest — the ORDER `regions.json` authored is preserved exactly — while no
 * clear-weather region can erase a settlement at 40 m. That erasure is what the shipped build did:
 * Blackwood's declared 0.018/m fed to a Gaussian, plus `1.978 / sightline_m` on top, put the
 * transmittance at 150 m at about 3e-9.
 */
export function airExtinction(regionExtinction, weather, sightlineM = 0) {
  // `RI-WLD08` §5 requires the declared sightline to be the distance the frame really stops at,
  // and W1-02's consumption probe (`tools/world/env-consumption.mjs` C4) requires every state to
  // change the fog in every region. So the state's thickness is the THICKER of its two
  // declarations — its `fogDensity` and its `sightline_m` — rather than the sum of them. Summing
  // them is what the shipped build did (`extinction + 1.978 / sightline_m`) and it double-counted
  // the same fact into a Gaussian, which is most of why the world stopped at 40 m.
  //
  // `sightline_m` is read as the HALF-contrast distance, `sigma = ln2 / S`, not the 2% distance.
  // "You can see 260 m" is a statement about where a silhouette stops being easy to read, not
  // about where 98% of it has gone; reading it the other way makes a 260 m clear day thicker than
  // the ceiling every region has to pass.
  const sw = Math.max(WEATHER_SIGMA(weather), sightlineM > 0 ? Math.LN2 / sightlineM : 0);
  const raw = Math.max(0, regionExtinction || 0) + sw;
  const ceiling = Math.max(CLEAR_AIR_CEILING, sw * WEATHER_CEILING_K);
  return ceiling * (1 - Math.exp(-raw / ceiling));
}

/**
 * THE REGION'S HEIGHT FALLOFF, AND WHY IT IS KEYED ON A COLOUR.
 *
 * `game/data/world/regions.json` already declares `fog.height_falloff_m` for all thirteen regions —
 * 26 m in the Deep Marshes, 340 m in the Salt Hills — and NOTHING has ever read it. It is exactly
 * the parameter this model needs. But `renderer.js` builds the object it hands to `apply()` as
 * `{ colour, extinction, glow }` and `renderer.js` is W1-30A's file this round, so B cannot add the
 * field to the call. Two other routes were available and both are worse: `sim.env.region` carries a
 * region id but inventory row **V15** records that it does not track a teleport, so it names the
 * wrong region after a fast traversal; and deriving the falloff from the extinction is simply
 * wrong — Thornmarsh and the Eastern Rootlands share an extinction of 0.0075 and declare 110 m and
 * 50 m.
 *
 * So the table is keyed on the region's own fog colour, which is unique across the thirteen and
 * comes from the same authored record in the same lookup, and which — unlike `sim.env.region` — is
 * read live from `field.regionAt()` every frame. A colour this does not know falls back to a
 * declared default rather than to a guess.
 *
 * **Delete this table** the moment `regionFog.heightFalloffM` is present on the object A passes;
 * the code below already prefers that field when it exists. That is a one-line change in
 * `renderer.js` and it has been sent to W1-30A.
 */
const REGION_HEIGHT_FALLOFF_M = {
  '#1b3a3e': 55,   // blackwood
  '#c9a87c': 150,  // clay-moor
  '#6c7a80': 120,  // crimson-coast
  '#3e4a6b': 26,   // deep-marshes
  '#b7c4c0': 50,   // eastern-rootlands
  '#e6e2d0': 45,   // hive
  '#9aa6ac': 55,   // marauders-coast
  '#b9c6ce': 340,  // salt-hills
  '#9fa9a2': 200,  // stone-forest
  '#edede6': 190,  // stone-wastes
  '#bfa286': 110,  // thornmarsh
  '#8fa6b4': 260,  // valus-ridge
  '#a8b7a6': 70,   // western-rootlands
};
const DEFAULT_HEIGHT_FALLOFF_M = 120;

export function regionHeightFalloff(regionFog) {
  if (!regionFog) return DEFAULT_HEIGHT_FALLOFF_M;
  if (Number.isFinite(regionFog.heightFalloffM)) return regionFog.heightFalloffM;
  if (Number.isFinite(regionFog.height_falloff_m)) return regionFog.height_falloff_m;
  const key = String(regionFog.colour || '').toLowerCase();
  return REGION_HEIGHT_FALLOFF_M[key] ?? DEFAULT_HEIGHT_FALLOFF_M;
}

// =============================================================================================
// THE SKY DOME
// =============================================================================================

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w;   // always at the far plane
}`;

const SKY_FRAG = `
varying vec3 vDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColour;
uniform vec3 uSunDir;
uniform float uSunSize;
uniform float uOvercast;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  // smoothstep rather than a linear ramp: a linear gradient bands badly at 8 bits, and
  // VP02-sky-only exists precisely to measure that (HARNESS.md §6).
  float t = smoothstep(0.0, 1.0, pow(h, 0.62));
  vec3 col = mix(uHorizon, uZenith, t);
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  float disc = smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.35, sd);
  float glow = pow(sd, 24.0) * 0.55 + pow(sd, 6.0) * 0.18;
  col += uSunColour * (disc * 1.6 + glow) * (1.0 - uOvercast * 0.92);
  // Static high cloud structure breaks the flat colour dome while remaining a pure function of
  // direction and weather. It is deliberately subtle in clear weather and broad when overcast.
  // Warped multi-octave cloud bands. Using only sine sums made the dome read as three broad
  // vertical blue stripes; domain warping produces bounded cellular banks with soft bases.
  vec2 p=d.xz/max(.18,d.y+.42);
  float warp=sin(p.x*3.7+p.y*2.1)+cos(p.y*4.6-p.x*1.8);
  float cloudField=sin(p.x*5.1+p.y*2.7+warp*.42)*.50
    +sin(p.y*9.4-p.x*4.3+warp*.24)*.28
    +cos((p.x+p.y)*17.0-warp*.15)*.14;
  float cloud=smoothstep(.13-uOvercast*.30,.55-uOvercast*.14,cloudField)*smoothstep(-.03,.28,d.y);
  float veil=smoothstep(-.30,.32,cloudField)*uOvercast*.38;
  col=mix(col,mix(uHorizon,uSunColour,.24),cloud*(.20+uOvercast*.34)+veil*.18);
  col += uSunColour * pow(max(0.0,1.0-abs(d.y)*4.2),3.0) * (1.0-uOvercast) * .035;
  gl_FragColor = vec4(col, 1.0);
}`;

// =============================================================================================
// THE IMAGE-BASED LIGHTING PROBE
// =============================================================================================
//
// A half-float equirectangular radiance map. three.js converts any equirect `scene.environment`
// into a roughness-convolved cubeUV through `PMREMGenerator` automatically
// (`WebGLCubeUVMaps.get`), so B does not need — and cannot get — a `WebGLRenderer` handle from
// inside `sky.js`. What it DOES need is to know that the conversion is cached on the texture object
// and only re-run for render-target textures: mutating a `DataTexture` in place, which is what the
// old code did every single frame, never invalidates it. The probe is therefore REPLACED on
// regeneration and the old texture disposed, which is what fires three's `onTextureDispose` and
// drops the stale convolution.
//
// Half float, not byte: the sun's disc is 30x brighter than the sky around it, and an 8-bit
// environment clips it to white, which is exactly why every material read the same however rough
// it claimed to be. `HalfFloatType` is texture-filterable in core WebGL2; `FloatType` needs
// `OES_texture_float_linear` and would fail to filter on some devices.
const PROBE_W = 128, PROBE_H = 64;

/**
 * Bake one radiance map. Pure function of its arguments — same arguments, same bytes — so the probe
 * is part of what a determinism check compares.
 *
 * `groundBounce` is the recipe's `envGroundBounce`: how much of the lower hemisphere is ground
 * rather than sky. It is an analytic stand-in for a cube capture of the actual world, and the plan's
 * falsification audit is right that it is one — there is no terrain, no settlement and no canopy in
 * this probe. What it does give, which 128 texels of clamped byte could not, is a correct sun
 * intensity ratio, a correct horizon gradient and a correct ground/sky split, which is what
 * separates a rough surface from a smooth one.
 */
export function bakeEnvironmentProbe({ zenith, horizon, ground, sunColour, sunDir, overcast, sunGain = 1, groundBounce = 0.35 }) {
  const data = new Uint16Array(PROBE_W * PROBE_H * 4);
  const half = THREE.DataUtils.toHalfFloat;
  const one = half(1);
  // Hoisted scalars, and no allocation anywhere in the loop: this runs on the main thread on a
  // bucket change and the plan's budget for it is 2 ms.
  const hr = horizon.r, hg = horizon.g, hb = horizon.b;
  const zr = zenith.r, zg = zenith.g, zb = zenith.b;
  const gr = ground.r, gg = ground.g, gb = ground.b;
  const sr = sunColour.r, sg = sunColour.g, sb = sunColour.b;
  const dx = sunDir.x, dy = sunDir.y, dz = sunDir.z;
  const sunScale = (1 - overcast) * sunGain;
  for (let y = 0; y < PROBE_H; y++) {
    // equirect: row 0 is +Y (zenith), row H-1 is -Y (nadir)
    const theta = (y + 0.5) / PROBE_H * Math.PI;      // 0 at zenith
    const sy = Math.cos(theta);
    const st = Math.sin(theta);
    const up = sy > 0 ? Math.pow(sy, 0.62) : 0;
    const down = sy < 0 ? -sy : 0;
    const gmix = down > 0 ? down * groundBounce + (1 - groundBounce) * down * 0.25 : 0;
    // sky above the horizon, ground bounce below it — the row's colour, before the sun
    const br = (hr + (zr - hr) * up) * (1 - gmix) + gr * gmix;
    const bg = (hg + (zg - hg) * up) * (1 - gmix) + gg * gmix;
    const bb = (hb + (zb - hb) * up) * (1 - gmix) + gb * gmix;
    for (let x = 0; x < PROBE_W; x++) {
      const phi = (x + 0.5) / PROBE_W * Math.PI * 2;
      const vx = Math.cos(phi) * st, vz = Math.sin(phi) * st;
      let sd = vx * dx + sy * dy + vz * dz;
      if (sd < 0) sd = 0;
      // The sun's disc and its glow, unclipped because this is a half-float target. `pow` by
      // repeated squaring: sd^8 and sd^64 with five multiplies rather than two Math.pow calls.
      const s2 = sd * sd, s4 = s2 * s2, s8 = s4 * s4, s64 = s8 * s8 * s8;
      // Deliberately NOT a hard disc. The directional `sun` light already delivers the sun's
      // irradiance; a 60x disc in the probe as well double-counts it into the diffuse mip and
      // washes the shadows out. What the probe owes is a bright, small SPECULAR source, which is
      // what separates roughness 0.05 from roughness 0.9.
      const hot = (s64 * 9.0 + s8 * 0.40) * sunScale;
      const i = (y * PROBE_W + x) * 4;
      data[i] = half(br + sr * hot);
      data[i + 1] = half(bg + sg * hot);
      data[i + 2] = half(bb + sb * hot);
      data[i + 3] = one;
    }
  }
  const tex = new THREE.DataTexture(data, PROBE_W, PROBE_H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  // Half-float data is already linear radiance; tagging it sRGB would decode it a second time.
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.name = 'w1-30b-environment-probe';
  tex.needsUpdate = true;
  return tex;
}

/**
 * The probe spec for a named recipe. **This is the entry point W1-30G consumes for per-room
 * interior probes** — G calls it with the room's own hearth/emissive colours and gets back a
 * texture it can assign to a room's `Mesh.material.envMap` or to `scene.environment` while the
 * player is inside, without reimplementing any of the baking above.
 *
 * @param {string} recipeId one of `knownLightingRecipes()`
 * @param {{zenith:THREE.Color, horizon:THREE.Color, ground:THREE.Color, sunColour:THREE.Color,
 *          sunDir:THREE.Vector3, overcast?:number, intensity?:number}} place the colours of the
 *        actual room or region; a recipe never invents a colour.
 * @returns {{texture:THREE.DataTexture, intensity:number, recipeId:string}}
 */
export function environmentProbeSpec(recipeId, place) {
  const r = lightingRecipe(recipeId);
  const texture = bakeEnvironmentProbe({
    zenith: place.zenith, horizon: place.horizon, ground: place.ground,
    sunColour: place.sunColour, sunDir: place.sunDir,
    overcast: Number.isFinite(place.overcast) ? place.overcast : 0,
    sunGain: r.key, groundBounce: r.envGroundBounce,
  });
  return { texture, intensity: r.env * (Number.isFinite(place.intensity) ? place.intensity : 1), recipeId };
}

// =============================================================================================

/** Shadow geometry. `distance` is how far from the camera shadows are drawn, in metres. */
const SHADOW_TIERS = {
  high: { mapSize: 4096, distance: 150 },
  low: { mapSize: 2048, distance: 90 },
};

export class Sky {
  constructor(scene, opts = {}) {
    this.features = {
      shadows: true, ibl: true, atmosphere: true, sky: true, lighting: true,
      // W1-30B's own off-switches. Each is one of this piece's changes and each must be provably
      // switchable, because a feature whose off-switch does not change pixels is a hard fail.
      heightFog: true,      // false -> flat Beer-Lambert, the "atmosphere has height" null control
      shadowFit: true,      // false -> the old player-centred 120 m box, the shadow-range control
      probe: true,          // false -> no environment texture at all
      rainDepth: true,      // false -> uniform-opacity streaks, the "rain has depth" null control
    };
    this.uniforms = {
      uZenith: { value: new THREE.Color(0x2f5f95) },
      uHorizon: { value: new THREE.Color(0xbfc6b4) },
      uSunColour: { value: new THREE.Color(0xfff0d0) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunSize: { value: 0.004 },
      uOvercast: { value: 0 },
    };
    const geo = new THREE.SphereGeometry(1, 32, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);

    // ---- the sun and its shadow ------------------------------------------------------------
    this.shadowTier = SHADOW_TIERS[opts.shadowTier] ? opts.shadowTier : 'high';
    const tier = SHADOW_TIERS[this.shadowTier];
    this.shadowDistance = tier.distance;
    this.sun = new THREE.DirectionalLight(0xfff0d8, 3.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(tier.mapSize, tier.mapSize);
    // The frustum is refitted every frame by `_fitShadow()`; these are only the values that hold
    // until the first fit, and `near` is deliberately small. The old value was 40 — a near plane
    // 40 m in front of a light placed 120 m from its target, which clips anything within 40 m of
    // the light and is the reason a tall ridge could stop casting.
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 600;
    this.sun.shadow.camera.left = -60;
    this.sun.shadow.camera.right = 60;
    this.sun.shadow.camera.top = 60;
    this.sun.shadow.camera.bottom = -60;
    // Bias in world units of the fitted box's own texel, not a constant. The old pair
    // (-0.0012, 0.25) was tuned for a 120 m / 2048 box — 0.25 m of normal bias is four texels
    // there, and it is what erased every contact shadow: a post's shadow within a quarter of a
    // metre of its own base was pushed off the geometry entirely.
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.normalBias = 0.08;
    // Three.js does NOT recompute an orthographic shadow frustum from its properties, so
    // this call is load-bearing: without it the shadow camera keeps its default 10x10 m
    // box and the entire scene renders fully shadowed.
    this.sun.shadow.camera.updateProjectionMatrix();
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfd0e0, 0x3a3527, 0.5);
    scene.add(this.hemi);

    // A low, colour-bearing fill keeps vertical and back-facing forms readable when the fitted
    // sun shadow covers them.  It is deliberately weaker than either celestial key and follows
    // the region/weather colour below; this is scene lighting, not an exposure lift or UI grade.
    this.fill = new THREE.AmbientLight(0x8b9488, 0.24);
    scene.add(this.fill);

    // ---- precipitation ----------------------------------------------------------------------
    // Bounded deterministic precipitation. Geometry is allocated once; apply() rewrites the
    // streak endpoints from simulation frame and weather intensity, never from wall time.
    //
    // W1-30B: the column is 96 m across rather than 28 m, and every streak carries its own RGBA
    // vertex colour. Inventory row **V07** is that precipitation reads as scratches on the lens —
    // hard white lines of uniform width and opacity at every depth. It was uniform because the
    // whole field was within 14 m of the camera and one material opacity covered all of it. Now
    // the alpha of each streak is the same Beer-Lambert transmittance the fog uses, evaluated at
    // that streak's distance, so a drop at 60 m is a fraction of the weight of a drop at 5 m and
    // the rain has depth for the same reason the world does.
    this.rainCount = 900;
    this.rainSpan = 96;
    this.rainPos = new Float32Array(this.rainCount * 2 * 3);
    this.rainCol = new Float32Array(this.rainCount * 2 * 4);
    this.rainSeed = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      this.rainSeed[i * 3] = hash1(i * 17 + 3);
      this.rainSeed[i * 3 + 1] = hash1(i * 29 + 7);
      this.rainSeed[i * 3 + 2] = hash1(i * 43 + 11);
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    // itemSize 4 is what makes three define USE_COLOR_ALPHA, which is what gives a line a
    // per-vertex alpha. With itemSize 3 the alpha channel silently does nothing.
    rainGeo.setAttribute('color', new THREE.BufferAttribute(this.rainCol, 4));
    this.rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({
      color: 0xffffff, vertexColors: true, transparent: true, opacity: 1,
      depthWrite: false, toneMapped: false,
    }));
    this.rain.name = 'weather-precipitation-bounded-900';
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);

    // The moon is not a second, unrelated art light. It is the exact inverse of the one
    // celestial direction used by the dome and sun, and only contributes after sunset.
    this.moon = new THREE.DirectionalLight(0x8ca9d8, 0);
    this.moon.castShadow = false; // one fitted directional shadow atlas is the bounded policy
    scene.add(this.moon); scene.add(this.moon.target);

    // ---- the environment probe ---------------------------------------------------------------
    this.environment = null;
    this._probeKey = null;
    this._probeBakes = 0;
    this._probeMs = 0;

    this.scene = scene;
    this.scene.fog = new HeightFog(0x9aa79a, 0.0030, DEFAULT_HEIGHT_FALLOFF_M);
    this.scene.environmentIntensity = 1;

    // Set by `followCamera()`, which `renderer.render()` calls every frame after `apply()`. The
    // shadow volume is fitted to the camera, and `apply()` does not receive one — its signature is
    // `renderer.js`'s, which is W1-30A's file. Using the camera as it stood at the end of the
    // previous frame is deterministic (the camera pose is a pure function of simulation state) and
    // is one 60 Hz frame of lag on the shadow box, which is below the threshold at which a shadow
    // edge can be seen to move. Before the first `followCamera()` the fit falls back to the old
    // player-centred box, so a single-frame capture that never renders still gets shadows.
    this._camera = null;
    this._lastFit = null;
  }

  // -------------------------------------------------------------------------------------------

  /**
   * Fit the directional shadow volume to what the camera can actually see.
   *
   * The old fit was a 120 m box centred on the player's feet, which is why the shadow sabotage
   * moves 13% of the pixels at the spawn (where the player is) and 0.6% on the Lilmoth approach
   * (where the subject is 120 m away). A vista is the shot a player judges a world by and it had no
   * shadow structure in it at all.
   *
   * WHY A BOUNDING SPHERE AND NOT A TIGHT BOX. A light-space AABB of the view frustum is tighter,
   * and it changes size and shape as the camera yaws, so the shadow map's texel grid changes with
   * it and every shadow edge crawls. A sphere is rotation-invariant: the box is the same size at
   * every heading, which is the precondition for texel snapping to actually hold the edges still.
   * The cost is texel density — about 0.086 m per texel at 4096 over 150 m, against 0.059 m over
   * 60 m before. That is the trade this piece is making and the human read on the vistas is what
   * judges it.
   *
   * NOT A CASCADE. Three cascades were the plan's item 2. three.js has no cascaded shadow map, so
   * cascades mean either three co-directional lights sharing the sun's intensity — which puts a
   * step in the shadow STRENGTH at each split, and "a cascade set with a visible ring" is a hard
   * fail in this same plan — or overriding the shadow-mask shader chunk, which is a seam into
   * every material and would collide with W1-30A's compositor work mid-round. One ring-free fitted
   * map is the substitution, it is recorded as one, and what would overturn it is the near-field
   * reading as mush on hardware: if it does, real CSM in a shared chunk is the next step and it
   * needs a written seam agreement with A first.
   */
  _fitShadow(dir, focus) {
    const shadow = this.sun.shadow;
    const mapSize = shadow.mapSize.x;
    const cam = this._camera;
    let cx, cy, cz, radius;

    if (cam && cam.isPerspectiveCamera && this.features.shadowFit) {
      const near = Math.max(0.05, cam.near);
      const far = Math.max(near + 1, Math.min(this.shadowDistance, cam.far));
      const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov * 0.5));
      const tanW = tanH * cam.aspect;
      const a2 = tanW * tanW + tanH * tanH;
      // The sphere through both corner rings: equate |corner - (0,0,z0)| for near and far.
      let z0 = (a2 + 1) * (near + far) * 0.5;
      z0 = Math.min(far, Math.max(near, z0));
      radius = Math.max(
        Math.hypot(far * tanW, far * tanH, far - z0),
        Math.hypot(near * tanW, near * tanH, near - z0),
      );
      const fwd = new THREE.Vector3();
      cam.getWorldDirection(fwd);
      cx = cam.position.x + fwd.x * z0;
      cy = cam.position.y + fwd.y * z0;
      cz = cam.position.z + fwd.z * z0;
    } else {
      // Fallback and null control: the pre-W1-30B player-centred box.
      radius = 60;
      cx = focus ? focus.x : 0; cy = focus ? focus.y : 0; cz = focus ? focus.z : 0;
    }

    // Light space: an orthonormal basis with `fwd` pointing from the light toward the scene.
    const lf = dir.clone().negate().normalize();
    const upSeed = Math.abs(lf.y) > 0.995 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(upSeed, lf).normalize();
    const up = new THREE.Vector3().crossVectors(lf, right).normalize();

    // Snap the centre to the shadow map's own texel grid, in light space, so a slowly moving
    // camera cannot swim the projection across stationary geometry.
    const texel = (2 * radius) / mapSize;
    const u = Math.round((cx * right.x + cy * right.y + cz * right.z) / texel) * texel;
    const v = Math.round((cx * up.x + cy * up.y + cz * up.z) / texel) * texel;
    const w = cx * lf.x + cy * lf.y + cz * lf.z;
    const centre = new THREE.Vector3(
      right.x * u + up.x * v + lf.x * w,
      right.y * u + up.y * v + lf.y * w,
      right.z * u + up.z * v + lf.z * w,
    );

    // Stand the light off far enough that a 400 m ridge between it and the sphere still casts.
    const backoff = radius + 420;
    this.sun.position.copy(dir).multiplyScalar(backoff).add(centre);
    this.sun.target.position.copy(centre);
    this.sun.target.updateMatrixWorld();

    const c = shadow.camera;
    if (c.left !== -radius || c.far !== backoff + radius + 20) {
      c.left = -radius; c.right = radius; c.top = radius; c.bottom = -radius;
      c.near = 0.5; c.far = backoff + radius + 20;
      c.updateProjectionMatrix();
    }
    // Bias in units of this fit's texel. A constant bias is wrong the moment the box resizes.
    shadow.normalBias = texel * 1.4;
    shadow.bias = -0.9 * (texel / (c.far - c.near));
    this._lastFit = { radius, texel, centre: centre.toArray(), backoff, mapSize };
    return this._lastFit;
  }

  /**
   * @param {number} hours 0..24
   * @param {string} weatherId a key of WEATHER
   * @param {THREE.Vector3} focus where the player is
   * @param {object|null} regionFog `{ colour, extinction, glow }` from the live region lookup
   * @param {object|null} env `sim.env`
   * @param {number} frame the simulation frame
   * @param {object|null} overhead the roof field from `Renderer._updateOverheadField()`, or null
   *        for "open sky everywhere". See the D2 note below.
   */
  apply(hours, weatherId, focus, regionFog, env, frame = 0, overhead = null) {
    const w = WEATHER[weatherId];
    if (!w) throw new Error(`unknown weather '${weatherId}'. Named states: ${Object.keys(WEATHER).join(', ')}`);

    // Sun elevation: noon is up, midnight is down. Pure arithmetic, deterministic.
    const ang = ((hours - 6) / 24) * Math.PI * 2;
    const elev = Math.sin(ang);                       // -1 .. 1
    const azim = ((hours / 24) * Math.PI * 2) - Math.PI * 0.5;
    const dir = new THREE.Vector3(Math.cos(azim) * 0.75, Math.max(-0.4, elev), Math.sin(azim) * 0.75).normalize();

    const day = Math.max(0, Math.min(1, elev * 1.6 + 0.28));   // 0 at night, 1 at noon
    const dusk = Math.max(0, 1 - Math.abs(elev) * 4.2);        // warm band near the horizon
    const night = 1 - Math.max(0, Math.min(1, day * 2.2));
    const overcast = w.overcast;

    // ---- the recipe --------------------------------------------------------------------------
    // The named rig this condition is. Pure function of terms already derived above, so two runs
    // at the same hour in the same weather always name the same recipe, and the id is published on
    // the lighting frame — which makes it part of what a determinism check compares.
    const recipeId = recipeForConditions({ day, night, overcast, rain: w.rain, dusk });
    const R = lightingRecipe(recipeId);

    const zen = new THREE.Color(
      lerp(0.024, 0.115, day) * w.tint[0] + dusk * 0.05,
      lerp(0.036, 0.305, day) * w.tint[1] + dusk * 0.03,
      lerp(0.082, 0.620, day) * w.tint[2] + dusk * 0.02);
    // F4 ROUND 2 — THE DAYTIME HORIZON IS THE ONLY COLOUR THE SHADOW SIDE CAN COME FROM, AND IT
    // WAS THE WARMEST THING IN THE FRAME. The day end of this triple was (0.760, 0.790, 0.700):
    // a pale yellow-green. It is not one colour among several — `hor` is read FOUR times below
    // (`hemi.color`, `fill.color`, the fog lerp, and `bakeEnvironmentProbe`'s `horizon`), so every
    // ambient term in a daylight frame took its hue from here, and the key at (1.00, 0.94, 0.82)
    // is the same family. `RI-VIS03` M6 exists to catch exactly that — *"a single white
    // DirectionalLight plus a white AmbientLight produces hue_offset ~ 0"* — and measured on the
    // landed r1 build it reads 3.71 deg full-frame / 7.16 deg on the sealed pair01 crop, against
    // an `exterior_daylight` minimum of 15 and a hard fail below 6. This repo's own vendored
    // modern-fidelity plates, same instrument, same session, read 12.49-143.28 deg (n = 8,
    // `reports/f4r2/plates-all` — and the first six reproduce the r1 critic's figures exactly).
    //
    // WHY THIS LINE AND NOT A RECIPE MULTIPLIER, WHICH IS WHAT ROUND 1 REACHED FOR. Measured at
    // pair01, 08:00, on the sealed judged crop, ablating one term at a time — the arms nobody in
    // this project had ever run: `key_off` 26.33, `env_off` 8.10, `hemi_off` 2.18, `fill_off`
    // 2.04, against that run's own noise floor (base re-captured after every other arm) of 1.86.
    // THE HEMISPHERE AND THE AMBIENT FILL ARE AT OR INSIDE THE NOISE FLOOR. You cannot colour a
    // shadow with a light whose removal is indistinguishable from re-taking the photograph, which
    // is why the page-side battery that cooled the hemisphere by 40% at constant luminance moved
    // `hue_offset` by 0.18 deg (7.16 -> 7.34), and why warming the KEY made it WORSE (7.16 ->
    // 5.84 at warm 0.70): the shadow side of this world is already the warm one, so warming the
    // key closes the gap instead of opening it. Seven candidates, none above 7.34.
    //
    // The one ambient term that IS resolvable is the environment probe (`env_off` 8.10, 4.4x the
    // floor) — and the probe is baked from `zenith`, `horizon` and `ground`. `horizon` is this
    // line. So this is the lever, and it is the only one.
    //
    // AT MATCHED LUMINANCE, ON PURPOSE (S59). Old day end (0.760, 0.790, 0.700) has Rec.709
    // luminance 0.77706; the new (0.677, 0.790, 0.944) has 0.77707. The lever CANNOT buy hue with
    // brightness, which is the trade S59 was written about and the one a "make it bluer" change
    // would otherwise smuggle in.
    //
    // WHAT IT CANNOT REACH, BY CONSTRUCTION, AND THIS IS THE PRESERVATION CLAUSE BUILT INTO THE
    // ARITHMETIC RATHER THAN ASSERTED BESIDE IT: the term is `lerp(nightEnd, dayEnd, day)`, so at
    // `day = 0` it is bit-identical and NIGHT IS UNTOUCHED; and twelve lines below, `hor` is
    // lerped toward a neutral by `overcast`, so at full overcast it is bit-identical and the two
    // recipes this round does not own (`overcast-flat`, `storm`) ARE UNTOUCHED AT THEIR OWN
    // WEATHER. Both are checked as null controls rather than argued.
    const hor = new THREE.Color(
      lerp(0.045, 0.677, day) * w.tint[0] + dusk * 0.36,
      lerp(0.058, 0.790, day) * w.tint[1] + dusk * 0.17,
      lerp(0.090, 0.944, day) * w.tint[2] + dusk * 0.06);
    zen.lerp(new THREE.Color(0.30 * day + 0.02, 0.31 * day + 0.02, 0.33 * day + 0.03), overcast);
    hor.lerp(new THREE.Color(0.40 * day + 0.03, 0.41 * day + 0.03, 0.42 * day + 0.04), overcast);

    this.uniforms.uZenith.value.copy(zen);
    this.uniforms.uHorizon.value.copy(hor);
    this.uniforms.uSunDir.value.copy(dir);
    this.uniforms.uOvercast.value = overcast;
    const sunCol = this.uniforms.uSunColour.value;
    sunCol.setRGB(
      lerp(0.55, 1.00, day) + dusk * 0.35, lerp(0.42, 0.94, day) + dusk * 0.10, lerp(0.62, 0.82, day));
    // The recipe's `keyWarmth` pushes the key toward the horizon (warm) or the zenith (cool). This
    // is what makes 08:00, 13:00 and 19:30 differ in COLOUR TEMPERATURE and not only in elevation.
    if (R.keyWarmth > 0) sunCol.lerp(hor, R.keyWarmth * 0.30);
    else if (R.keyWarmth < 0) sunCol.lerp(zen, -R.keyWarmth * 0.30);

    // ---- the key -----------------------------------------------------------------------------
    this.sun.intensity = this.features.lighting ? w.sunIntensity * Math.max(0.02, day) * R.key : 0;
    this.sun.color.copy(sunCol);
    this.sun.castShadow = this.features.shadows && R.shadow > 0;
    this.shadowDistance = SHADOW_TIERS[this.shadowTier].distance * (R.shadow || 1);
    this._fitShadow(dir, focus);
    this.moon.position.copy(dir).multiplyScalar(-120).add(this.sun.target.position);
    this.moon.target.position.copy(this.sun.target.position); this.moon.target.updateMatrixWorld();

    // ---- night ---------------------------------------------------------------------------------
    // `RI-WLD04` M17 step 6: the sample is repeated at night and **night accuracy >= 70% is
    // required** — "a region that is only identifiable in clear daylight is half-built". Measured
    // on the shipped build, the thirteen regions scored **28.2%** at 01:00, with a mean
    // inter-centroid distance of 15.25 against 99.51 by day: at `day = 0` the ambient term fell to
    // 10% and the region's own fog hue was multiplied by 0.34, so every region rendered as the same
    // near-black. Two changes, both of them art direction rather than exposure:
    //
    //   * the night ambient takes the REGION's hue instead of the sky horizon's, so what little
    //     light there is carries region identity — a marsh under two moons is green-black, a salt
    //     pan is blue-white, a kiln moor is ember-red;
    //   * the floors rise. Morrowind's nights are dark and READABLE; a frame a judge cannot
    //     classify is not a dark frame, it is a missing frame.
    // F4 (roadmap ring 1): `* (R.moon ?? 1)`. Until this line the moon was the ONLY light in the
    // rig with no recipe lever on it, which meant `night-moon`'s `key` was scaling a sun of
    // intensity 0.0126 (2.1 * max(0.02, day=0) * 0.30, read back off the live scene at 19:30)
    // while the light actually carrying the night — this one, at 0.82 — could not be addressed at
    // all. Every exterior recipe declares `moon: 1.0`, so this is a no-op everywhere except
    // `night-moon`, which sets 3.60. Measured at pair05: the directional key goes from moving the
    // judged window 2.64 mean|d|rgb to moving it 5.88, against the probe's 2.13.
    this.moon.intensity = this.features.lighting ? night * (0.54 + (1 - w.overcast) * 0.28) * (R.moon ?? 1) : 0;
    const regionNight = regionFog ? new THREE.Color(regionFog.colour) : hor.clone();
    if (regionFog && regionFog.glow) regionNight.lerp(new THREE.Color(regionFog.glow), 0.55);
    this.hemi.intensity = this.features.ibl ? w.ambient * Math.max(0.82, 1.18 + day * 0.72) * R.sky : 0;
    this.hemi.color.copy(hor).lerp(regionNight, night * 0.85);
    const groundColour = new THREE.Color(0.34, 0.31, 0.24).lerp(regionNight, night * 0.55);
    this.hemi.groundColor.copy(groundColour);
    this.fill.intensity = this.features.lighting ? w.ambient * lerp(0.68, 1.34, day) * R.fill : 0;
    this.fill.color.copy(hor).lerp(regionNight, night * 0.70);

    // ---- the air -------------------------------------------------------------------------------
    const heightFalloff = regionHeightFalloff(regionFog) * (R.fog.height || 1);
    // WHAT HAPPENED TO `sightline_m`. It used to be ADDED as `1.978 / sightline_m` — a FogExp2
    // density laid on top of a region extinction that was already being read as one — and the two
    // together are what erased the world: at Lilmoth in clear weather they put the transmittance at
    // 150 m at about 3e-9. It is now one of the two declarations the WEATHER's own thickness is
    // taken from, inside `airExtinction()`, rather than a second fog added to the first.
    const sightline = env && Number.isFinite(env.sightlineM) ? env.sightlineM : 0;
    let sigma0;
    if (regionFog) {
      // The region owns the hue and the floor; the weather can only ever make the air thicker,
      // never clearer than the region's own.
      const rc = new THREE.Color(regionFog.colour);
      this.scene.fog.color.copy(rc).lerp(hor, 0.34 * (1 - night * 0.7)).multiplyScalar(lerp(0.62, 1.0, day));
      sigma0 = airExtinction(regionFog.extinction, w, sightline) * (R.fog.extinction || 1);
      // Kept only so the atmosphere null control can rebuild the shipped model's density from the
      // same inputs on the same frame, without re-deriving which region the camera is in.
      this._lastRegionExtinction = regionFog.extinction;
    } else {
      sigma0 = airExtinction(0, w, sightline) * (R.fog.extinction || 1);
      this.scene.fog.color.copy(hor).multiplyScalar(0.92);
    }
    this.scene.fog.sigma0 = this.features.atmosphere ? sigma0 : 0;
    this.scene.fog.heightFalloff = this.features.heightFog ? heightFalloff : 0;

    // ---- precipitation -------------------------------------------------------------------------
    this.rain.visible = this.features.atmosphere && w.rain > 0.02;
    // ---- D2: RAIN DOES NOT FALL THROUGH ROOFS ------------------------------------------------
    // The streak field is generated in a column around `focus`. Nothing ever asked whether a given
    // streak was under a roof, so walking under the raised decks at Lilmoth put streaks INSIDE the
    // covered volume, in front of the ceiling — the audit's D2, visible in every frame of
    // play/016..032.
    //
    // Note what the defect is NOT: the material is depth-TESTED (only `depthWrite` is off), so
    // this was never a sorting bug. The drops are genuinely spawned in the air beneath the deck,
    // between the player and the underside, and no amount of depth state can help with that. The
    // emitter has to know about the ceiling, which is what `overhead` is. Streaks are COMPACTED to
    // the front of the buffer and `drawRange` shortened, so a covered player also pays less
    // overdraw rather than more.
    if (this.rain.visible && focus) {
      const span = this.rainSpan, half = span * 0.5;
      const fall = (frame * 0.31) % 22;
      const n = Math.max(1, Math.round(this.rainCount * w.rain));
      const base = 0.16 + w.rain * 0.30;
      let out = 0;
      for (let i = 0; i < n; i++) {
        const x = (this.rainSeed[i * 3] - 0.5) * span;
        const z = (this.rainSeed[i * 3 + 1] - 0.5) * span;
        const y = ((this.rainSeed[i * 3 + 2] * 30 - fall + 30) % 30) - 6;
        if (overhead) {
          // World coordinates: the streak field is a child transform on `focus`.
          const wy = focus.y + y;
          if (wy < ceilingAt(overhead, focus.x + x, focus.z + z)) continue;
        }
        // V07: the same air the world is seen through. A streak at 60 m carries the transmittance
        // of 60 m of it, so the far half of the field is a veil and the near half is rain.
        const d = Math.hypot(x, y, z);
        const t = this.features.rainDepth ? Math.exp(-Math.max(sigma0, 0.004) * d) * (1 - Math.min(0.85, d / (half * 1.35))) : 1;
        const a = base * Math.max(0, t);
        const k = out * 6, ck = out * 8; out++;
        this.rainPos[k] = x; this.rainPos[k + 1] = y; this.rainPos[k + 2] = z;
        this.rainPos[k + 3] = x + 0.12; this.rainPos[k + 4] = y - (0.9 + w.rain * 0.8); this.rainPos[k + 5] = z + 0.05;
        // Streaks take the fog's colour, so rain in Blackwood is Blackwood's rain.
        const fc = this.scene.fog.color;
        const cr = 0.72 + fc.r * 0.36, cg = 0.78 + fc.g * 0.32, cb = 0.82 + fc.b * 0.30;
        this.rainCol[ck] = cr; this.rainCol[ck + 1] = cg; this.rainCol[ck + 2] = cb; this.rainCol[ck + 3] = a;
        this.rainCol[ck + 4] = cr; this.rainCol[ck + 5] = cg; this.rainCol[ck + 6] = cb; this.rainCol[ck + 7] = a * 0.55;
      }
      this.rain.geometry.setDrawRange(0, out * 2);
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.geometry.attributes.color.needsUpdate = true;
      this.rain.position.copy(focus);
      // A fully covered player gets no streaks at all, and drawing an empty LineSegments is a
      // draw call for nothing.
      if (out === 0) this.rain.visible = false;
    }

    // ---- the environment probe -----------------------------------------------------------------
    // Regenerated on a bucket change, never per frame. The bucket is 1/12 of a game hour plus the
    // weather and the region, which is at most twelve bakes per game hour against the plan's
    // budget of four per game MINUTE, and it is a pure function of simulation state so a replay
    // bakes at the same frames.
    const probeKey = this.features.probe && this.features.ibl
      ? `${Math.round(hours * 12)}|${weatherId}|${regionFog ? regionFog.colour : '-'}|${recipeId}`
      : null;
    if (probeKey !== this._probeKey) {
      this._probeKey = probeKey;
      const old = this.environment;
      if (probeKey === null) {
        this.environment = null;
      } else {
        const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
        this.environment = bakeEnvironmentProbe({
          zenith: zen, horizon: hor, ground: groundColour, sunColour: sunCol, sunDir: dir,
          overcast, sunGain: R.key * Math.max(0.05, day), groundBounce: R.envGroundBounce,
        });
        this._probeBakes++;
        this._probeMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : 0) - t0;
      }
      // Disposing the OLD texture is what drops three's cached PMREM convolution of it
      // (`WebGLCubeUVMaps.onTextureDispose`). Without this the first probe ever baked would be the
      // only one the materials ever saw — which is precisely what the shipped build did.
      if (old) old.dispose();
    }
    this.scene.environment = this.features.ibl ? this.environment : null;
    this.scene.environmentIntensity = R.env;
    this.mesh.visible = this.features.sky;

    // W1-30S seam, W1-30B contract: publish this frame's lighting summary. Every value below is a
    // local this function already computed for its own uniforms, lights and fog.
    this.lastFrame = buildLightingFrame({
      sunDir: dir, sunColour: sunCol, sunIntensity: this.sun.intensity,
      moonDir: dir.clone().negate(), moonColour: this.moon.color, moonIntensity: this.moon.intensity,
      skyLuminance: this.hemi.intensity, ambientColour: this.fill.color,
      fogColour: this.scene.fog.color, fogDensity: this.scene.fog.sigma0,
      fogHeightFalloff: this.scene.fog.heightFalloff,
      // The extinction half of aerial perspective is applied per pixel above. This is the
      // INSCATTER half — the sun-facing brightening a full-screen pass adds — published for
      // W1-30A's compositor, which owns `render/post/**`.
      aerialInscatter: this.scene.fog.color.clone().lerp(sunCol, 0.5).multiplyScalar(R.fog.inscatter || 0),
      exposureTarget: R.exposure,
      regionId: env && env.region ? env.region : null, weatherId, timeOfDay: hours,
      day, night, dusk, overcast, recipeId,
      aerialParams: { sigma0: this.scene.fog.sigma0, heightFalloff: this.scene.fog.heightFalloff, inscatter: R.fog.inscatter || 0 },
    });
    return weatherId;
  }

  /** Which shadow tier is in force. `low` keeps the old single 2048 map over 90 m. */
  setShadowTier(tier) {
    if (!SHADOW_TIERS[tier]) throw new Error(`unknown shadow tier '${tier}' (have: ${Object.keys(SHADOW_TIERS).join(', ')})`);
    this.shadowTier = tier;
    this.sun.shadow.mapSize.set(SHADOW_TIERS[tier].mapSize, SHADOW_TIERS[tier].mapSize);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.shadowDistance = SHADOW_TIERS[tier].distance;
    return tier;
  }

  setFeature(name, enabled) {
    if (!(name in this.features)) throw new Error(`unknown sky sabotage '${name}' (have: ${Object.keys(this.features).join(', ')})`);
    this.features[name] = !!enabled;
    // The probe is a texture, so its off-switch has to invalidate the bake rather than wait for a
    // bucket change that might be a game hour away.
    if (name === 'probe' || name === 'ibl') this._probeKey = null;
    return this.features[name];
  }

  /** What the shadow fit did this frame — the instrument for the shadow rows. */
  shadowReport() {
    return {
      tier: this.shadowTier, mapSize: this.sun.shadow.mapSize.x, distance: this.shadowDistance,
      castShadow: this.sun.castShadow, fit: this._lastFit,
      bias: this.sun.shadow.bias, normalBias: this.sun.shadow.normalBias,
    };
  }

  /** What the probe did — the instrument for the IBL and budget rows. */
  environmentReport() {
    return {
      present: !!this.environment, width: PROBE_W, height: PROBE_H,
      type: 'HalfFloatType', bakes: this._probeBakes, lastBakeMs: +this._probeMs.toFixed(3),
      key: this._probeKey, intensity: this.scene.environmentIntensity,
    };
  }

  /** The dome is drawn at the far plane, so it must be centred on the camera every frame. */
  followCamera(camera) {
    this.mesh.position.copy(camera.position);
    if (camera.isPerspectiveCamera) this._camera = camera;
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * THE ROOF OVER A POINT. `overhead` is the coarse field `Renderer._updateOverheadField()` builds:
 * a square grid of `n x n` samples spanning the precipitation column, each holding the WORLD Y of
 * the underside of the lowest solid thing above that sample, or `Infinity` where the sky is open.
 *
 * Nearest-sample lookup, deliberately — no interpolation. Interpolating between "roof at 4 m" and
 * "open sky" would invent a sloping ceiling along every eave and let a band of rain through just
 * inside the edge of every deck, which is the defect in miniature. A hard edge one sample wide is
 * the honest artefact of a coarse field, and the field is sized so that sample is a few metres.
 *
 * @returns {number} world Y of the ceiling above (wx, wz), or Infinity for open sky.
 */
export function ceilingAt(overhead, wx, wz) {
  if (!overhead) return Infinity;
  const i = Math.round((wx - overhead.x0) / overhead.step);
  const j = Math.round((wz - overhead.z0) / overhead.step);
  if (i < 0 || j < 0 || i >= overhead.n || j >= overhead.n) return Infinity;
  return overhead.y[j * overhead.n + i];
}
