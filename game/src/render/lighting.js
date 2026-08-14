// W1-30B — the published lighting frame. One frozen object per frame.
//
// This is the A<->B seam and, since W1-30B, the only supported way to read what the sky decided.
// `sky.js` builds exactly one of these per `apply()`; `renderer.js` receives it through
// `renderer.setLightingFrame()`. Consumers today: the colour grade (`_updateGrade`, W1-30A), the
// province night lamps, and — once they land — G's interiors and the Deck's reference-plate
// renderer. None of them reads `sky.js` directly.
//
// WHY IT IS FROZEN. The plan's hard-fail list includes "`lighting.js` mutated after publication in
// a frame". A consumer that quietly writes `frame.fogDensity` to "just try something" produces a
// frame whose fog and whose grade disagree about the same scene, and nothing in the build would
// say so. `Object.freeze` turns that into a thrown TypeError in strict mode (every module here is
// an ES module, so strict is not optional) at the moment it happens rather than a wrong picture an
// hour later. The vectors and colours are cloned before freezing, so a consumer holding last
// frame's object still sees last frame's values.
//
// WHY EVERY FIELD IS READ, NOT DERIVED. Every value below is one `sky.apply()` already computed for
// its own uniforms, lights and fog. Nothing in this file decides anything; deciding it here would
// be a second implementation of the sky, which is exactly the duplication the seam exists to end.
'use strict';

/**
 * The field list, in the order the plan names it, plus the four legacy fields A already consumes.
 * Kept as data so a critic can assert the contract's shape without parsing the constructor.
 */
export const LIGHTING_FRAME_FIELDS = Object.freeze([
  // --- the contract W1-30B.md item 5 names -------------------------------------------------
  'sunDir', 'sunColour', 'sunIntensity', 'moonDir', 'moonColour', 'moonIntensity',
  'skyLuminance', 'ambientColour', 'fogColour', 'fogDensity', 'fogHeightFalloff',
  'aerialInscatter', 'exposureTarget', 'regionId', 'weatherId', 'timeOfDay',
  // --- the terms A's grade already reads, unchanged in name and meaning ---------------------
  'day', 'night', 'dusk', 'overcast',
  // --- provenance --------------------------------------------------------------------------
  'recipeId', 'aerialParams',
]);

const V3 = (v) => (v && typeof v.clone === 'function' ? v.clone() : v);
const NUM = (v, d = 0) => (Number.isFinite(v) ? v : d);

/**
 * Construct this frame's lighting-parameter object.
 *
 * Only `sky.js` should call this. Every argument is optional so that a partial caller gets a
 * complete object with declared defaults rather than a frame with holes in it — a consumer reading
 * `undefined` and silently treating it as 0 is how a fog term goes missing without a red gate.
 */
export function buildLightingFrame({
  sunDir = null, sunColour = null, sunIntensity = 0,
  moonDir = null, moonColour = null, moonIntensity = 0,
  skyLuminance = 0, ambientColour = null,
  fogColour = null, fogDensity = 0, fogHeightFalloff = 0,
  aerialInscatter = null, exposureTarget = null,
  regionId = null, weatherId = null, timeOfDay = 0,
  day = 0, night = 0, dusk = 0, overcast = 0,
  recipeId = null, aerialParams = null,
} = {}) {
  const frame = {
    sunDir: V3(sunDir), sunColour: V3(sunColour), sunIntensity: NUM(sunIntensity),
    moonDir: V3(moonDir), moonColour: V3(moonColour), moonIntensity: NUM(moonIntensity),
    skyLuminance: NUM(skyLuminance), ambientColour: V3(ambientColour),
    fogColour: V3(fogColour), fogDensity: NUM(fogDensity), fogHeightFalloff: NUM(fogHeightFalloff),
    // `aerialInscatter` is the sun-facing inscattering term B publishes for A's composite to
    // apply per pixel. B applies the *extinction* half of aerial perspective itself, in the
    // material fog chunk (`sky.js`, INSTALL THE ATMOSPHERE MODEL); the directional half needs the
    // sun vector in a full-screen pass, which lives in `render/post/**` and is A's to own.
    aerialInscatter: aerialInscatter === null ? null : V3(aerialInscatter),
    exposureTarget: exposureTarget === null ? null : NUM(exposureTarget),
    regionId, weatherId, timeOfDay: NUM(timeOfDay),
    day: NUM(day), night: NUM(night), dusk: NUM(dusk), overcast: NUM(overcast),
    recipeId, aerialParams,
  };
  return Object.freeze(frame);
}

/**
 * True when `frame` carries every field of the contract. The critic's cheap check: a frame that
 * has lost a field is a seam break, and a consumer reading `undefined` will not say so.
 */
export function lightingFrameComplete(frame) {
  if (!frame || typeof frame !== 'object') return false;
  return LIGHTING_FRAME_FIELDS.every((k) => k in frame);
}
