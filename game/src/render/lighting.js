// W1-30S seam pass.
//
// The frame's lighting parameters, published so a compositor/grade module can consume one
// object instead of reading `render/sky.js` directly (future owner: W1-30B — see W1-30.md's
// "A ↔ B" seam contract). This commit only gives the object a shape and a constructor:
// `sky.js` builds one from values it already computes internally for its own uniforms/lights,
// and nothing here changes what those values are or when they are computed.
'use strict';

/** Construct a frame's lighting-parameter object. Every field here is read, not derived —
 * `sky.js` passes in what it already computed for `this.uniforms`/`this.sun`/`this.hemi`/
 * `this.scene.fog` this frame. `exposureTarget` and `aerialParams` are declared by the A↔B
 * seam contract and left null until W1-30B computes them. */
export function buildLightingFrame({
  sunDir, sunColour, skyLuminance, day, night, dusk, overcast,
  fogColour, fogDensity, exposureTarget = null, aerialParams = null,
}) {
  return { sunDir, sunColour, skyLuminance, day, night, dusk, overcast, fogColour, fogDensity, exposureTarget, aerialParams };
}
