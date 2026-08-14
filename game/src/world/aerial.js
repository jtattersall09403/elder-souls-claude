// Aerial perspective: the haze thins with height, the way real air does.
//
// WHY THIS FILE EXISTS, measured before it was written (W1-30F, tools/visual/landform-reach.mjs).
//
// Every one of the thirteen region vistas captured by W1-30V has a dead-flat horizon, including
// Valus Ridge, whose own record declares 286 m of amplitude. The obvious reading — "the landform
// was never authored" — is FALSE, and the measurement says so: the baked raster in
// `game/data/world/terrain.json` carries 418 m of built relief in Valus Ridge, 264 m in the Salt
// Hills, 230 m in Blackwood, 214 m in the Stone Forest. It is in the collision surface, it is in
// the far mesh (`province.js#_buildFar`, 50 m quads over the whole province) and it is in the tile
// mesh (5.36 m quads). The shape exists all the way to the vertex buffer.
//
// It is deleted in the last stage. `render/sky.js` drives `THREE.FogExp2`, whose extinction is
// UNIFORM with height, from the region's `fog.extinction_per_m`. Measured per deck camera, the
// terrain relief inside the frustum against the relief that still transmits 10% of its radiance:
//
//     eye-blackwood            450.7 m in frame ->   1.6 m survives   (99.6% deleted)
//     eye-western-rootlands    415.7 m          ->   0.2 m            (99.95%)
//     eye-stone-wastes         446.6 m          ->   5.5 m            (98.8%)
//     eye-deep-marshes          75.5 m          ->   0.0 m            (100%)
//     eye-hive                 448.5 m          ->   6.5 m            (98.6%)
//
// Nine of thirteen eye-level shots lose more than 90% of their landform to the air in front of it.
// That is the mechanical cause of "region identity is carried entirely by palette and not at all by
// shape": with the ground erased past ~100-300 m, the only thing left in the far half of the frame
// IS the fog colour, and the fog colour is the palette.
//
// AND THE FIX WAS ALREADY DECLARED AND NEVER READ. Every one of the thirteen regions carries
// `fog.height_falloff_m` (26 m in the Deep Marshes, 340 m in the Salt Hills, 260 m on Valus Ridge)
// and the string `height_falloff` appears NOWHERE in `game/src`. It is the scale height of the haze
// layer: the number that says the mist lies in the low ground and a ridge stands out of it. This
// file is that field, consumed.
//
// THE MODEL. Extinction falls exponentially with height above a datum:
//
//     sigma(y) = sigma0 * exp( -(y - refY) / H )
//
// so the optical path from the camera at yC to a fragment at yF over distance d is
//
//     integral sigma ds = sigma0 * d * ( e^-a - e^-b ) / ( b - a ),   a = (yC-refY)/H, b = (yF-refY)/H
//
// which tends to sigma0 * d * e^-a as b -> a. The bracket is a pure SCALE on the existing density,
// so every value W1-02 and W1-30B tuned survives unchanged at the datum, where the scale is exactly
// 1. It is clamped to a maximum of 1: **this change can only ever make the world more visible,
// never less.** That is a property worth having and it is checked, not asserted.
//
// THE NULL CONTROL IS ONE NUMBER. `setAerialPerspective({ strength: 0 })` mixes the scale back to
// 1.0 in the shader and reproduces stock `FogExp2` exactly — same frames, same hashes. The plausible
// wrong answer this guards against is a change that "looks clearer" because it quietly lowered every
// region's extinction; strength 0 must return the old picture bit for bit, and if it does not, this
// module is doing something it did not admit to.
//
// OWNERSHIP. This is a new file created by W1-30F and is entirely inside its owned paths. It does
// NOT edit `render/sky.js` (three live pieces and an undeclared overlap) and it does NOT edit
// `game/data/world/regions.json` (W1-25's). If W1-30B later moves aerial perspective into `sky.js`,
// deleting the two calls in `province.js` reverses this completely.

'use strict';

import * as THREE from '../../vendor/three/three.module.js';

// [ falloff_m, refY_m, strength ]. ONE Float32Array, shared by reference across every material.
//
// That sharing is the whole mechanism and it is not an accident of style. three.js builds each
// material's uniform set with `UniformsUtils.clone(ShaderLib[id].uniforms)`, and `cloneUniforms`
// deep-copies only Color/Vector/Matrix/Texture/Quaternion and slices real Arrays — a Float32Array
// is none of those, so it is assigned by REFERENCE (three r180, three.core.js#cloneUniforms). One
// write here therefore reaches every material in the scene without a per-material walk, which is
// what makes this a global atmosphere rather than a terrain-only hack with a seam at every wall.
// A THREE.Vector3 here would be cloned per material and would silently stop working.
const STATE = new Float32Array([0, 0, 0]);

let installed = false;

/**
 * Patch the fog chunks and add the shared uniform to every built-in shader.
 *
 * Idempotent, and safe to call before or after materials are constructed: `ShaderChunk` is read
 * when a program is COMPILED and `ShaderLib[id].uniforms` when it is first bound, both of which
 * happen at the first render of that material, not at construction.
 */
export function installAerialPerspective() {
  if (installed) return false;
  installed = true;

  // --- vertex: carry the fragment's WORLD height alongside its depth --------------------------
  //
  // `modelMatrix * transformed` would be wrong for the instanced meshes this world is mostly made
  // of — it misses `instanceMatrix`. `mvPosition` is already view-space and post-instancing (the
  // stock chunk reads it for `vFogDepth`), so rotate it back with the camera's own basis instead.
  // viewMatrix's upper 3x3 is orthonormal, so the inverse rotation's Y row is its Y COLUMN, and no
  // `inverse()` is needed — which also keeps this compiling on GLSL ES 1.00.
  THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying float vFogWorldY;\n#endif';
  THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n'
    + '\tvFogWorldY = cameraPosition.y + dot( vec3( viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1] ), mvPosition.xyz );\n#endif';

  // --- fragment: the height-integrated scale on the existing density --------------------------
  THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n'
    + '\tuniform vec3 fogColor;\n\tvarying float vFogDepth;\n\tvarying float vFogWorldY;\n\tuniform vec3 uAerial;\n'
    + '\t#ifdef FOG_EXP2\n\t\tuniform float fogDensity;\n\t#else\n\t\tuniform float fogNear;\n\t\tuniform float fogFar;\n\t#endif\n'
    + '\tfloat esAerialScale( float yC, float yF ) {\n'
    + '\t\tfloat H = uAerial.x;\n'
    + '\t\tif ( H <= 0.0 ) return 1.0;\n'
    + '\t\tfloat a = ( yC - uAerial.y ) / H;\n'
    + '\t\tfloat b = ( yF - uAerial.y ) / H;\n'
    + '\t\tfloat d = b - a;\n'
    + '\t\tfloat s = abs( d ) < 0.0001 ? exp( -a ) : ( exp( -a ) - exp( -b ) ) / d;\n'
    // Upper clamp 1.0: below the datum this term would exceed 1 and THICKEN the haze. Refusing
    // that is what makes "this can only ever reveal, never hide" true rather than hoped for.
    // Lower clamp 0.08: a 12x sightline is already past every declared `sightline_m` in the
    // province, and an unbounded term goes to zero on a shot from the top of Valus Ridge and
    // deletes the atmosphere instead of the landform.
    + '\t\treturn clamp( s, 0.08, 1.0 );\n'
    + '\t}\n#endif';

  THREE.ShaderChunk.fog_fragment = '#ifdef USE_FOG\n'
    + '\tfloat esAerial = mix( 1.0, esAerialScale( cameraPosition.y, vFogWorldY ), uAerial.z );\n'
    + '\t#ifdef FOG_EXP2\n'
    + '\t\tfloat esFogDepth = fogDensity * vFogDepth * esAerial;\n'
    + '\t\tfloat fogFactor = 1.0 - exp( - esFogDepth * esFogDepth );\n'
    + '\t#else\n'
    + '\t\tfloat fogFactor = smoothstep( fogNear, fogFar, vFogDepth * esAerial );\n'
    + '\t#endif\n'
    + '\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif';

  // --- the uniform, on every built-in shader ---------------------------------------------------
  // A ShaderMaterial written elsewhere in the game supplies its own uniform set; it gets the
  // declaration from the chunk and, without a `uAerial` of its own, three leaves the uniform
  // unbound and GL reads 0 — which yields H <= 0 -> scale 1.0 -> stock fog. Fails safe.
  for (const key of Object.keys(THREE.ShaderLib)) {
    const u = THREE.ShaderLib[key].uniforms;
    if (u && u.fogDensity !== undefined && u.uAerial === undefined) u.uAerial = { value: STATE };
  }
  if (THREE.UniformsLib && THREE.UniformsLib.fog) THREE.UniformsLib.fog.uAerial = { value: STATE };
  return true;
}

/**
 * Set the haze layer. Called from `world/province.js` as the player crosses regions.
 *
 * @param {object} o
 * @param {number} o.falloff_m scale height of the haze; <= 0 disables and restores stock fog
 * @param {number} [o.refY_m]  the datum the layer sits on. Sea level (0) for this province, because
 *   its sea level IS 0. At a player's eye height in a marsh region the scale is within about a
 *   tenth of 1 (Blackwood: 6.3 m into a 55 m layer -> 0.89), so those regions keep the enclosure
 *   their own records ask for. It is NOT small at 26 m up, which is where the Deck's vista cameras
 *   sit: 26 m into that same layer is 0.57. Correct physics, and a real change to those frames.
 * @param {number} [o.strength] 0..1. 0 is the null control and reproduces stock fog exactly.
 */
export function setAerialPerspective({ falloff_m = 0, refY_m = 0, strength = 1 } = {}) {
  STATE[0] = Number.isFinite(falloff_m) ? Math.max(0, falloff_m) : 0;
  STATE[1] = Number.isFinite(refY_m) ? refY_m : 0;
  STATE[2] = Math.min(1, Math.max(0, Number.isFinite(strength) ? strength : 1));
  return aerialState();
}

/** What the shader is currently reading. The consumption probe reads this, not a JSON field. */
export function aerialState() {
  return { falloff_m: STATE[0], refY_m: STATE[1], strength: STATE[2], installed };
}

/**
 * The same arithmetic the shader runs, in JS, so the offline instrument and the frame agree.
 * Exported because a check that re-implements the formula it is checking cannot falsify it.
 */
export function aerialScale(camY, fragY, falloffM, refY = 0, strength = 1) {
  if (!(falloffM > 0)) return 1;
  const a = (camY - refY) / falloffM, b = (fragY - refY) / falloffM;
  const d = b - a;
  const s = Math.abs(d) < 1e-4 ? Math.exp(-a) : (Math.exp(-a) - Math.exp(-b)) / d;
  const clamped = Math.min(1, Math.max(0.08, s));
  return 1 + (clamped - 1) * Math.min(1, Math.max(0, strength));
}
