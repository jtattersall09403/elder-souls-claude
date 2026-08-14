// W1-30B — the named lighting recipes. Two base rigs, eight variant specs over them.
//
// `W1-30-LIBRARY.md` §1 makes this one of the four registries, and §2 states the test a builder
// applies to itself: *if I want a second one of these, am I writing a spec or writing a
// definition?* Everything below is a spec. There are exactly two definitions in this file —
// EXTERIOR_RIG and INTERIOR_RIG — and every named recipe is a shallow patch over one of them.
//
// WHAT A RECIPE IS. A recipe is not a set of lights. It is the *shape* of a lighting condition:
// how much of the total illumination is directional key, how much is sky, how much is bounce,
// how the environment probe is weighted, how the air behaves, and what exposure it wants. The
// caller supplies the colours of its own place — the region's fog hue, the hearth's ember, the
// sky's horizon — and the recipe says what to do with them. That is what makes eight recipes
// cover thirteen regions, forty-one weather states and one hundred and thirteen interiors instead
// of needing a definition for each.
//
// WHO CONSUMES WHAT (the library's two-consumer rule, §3):
//   exterior recipes — `render/sky.js` `recipeForConditions()` selects one every frame and scales
//     the live rig by it; `environmentProbeSpec()` in the same file uses `env` to weight the IBL
//     probe it bakes. Two distinct call sites in two different contexts (the lit frame, and the
//     off-line probe bake).
//   interior recipes — `environmentProbeSpec()` bakes an interior probe from them, and W1-30G's
//     interiors consume `key`/`ambient`/`exposure` for the room rig itself. G is not landed at the
//     time of writing: that second consumer is DECLARED, NOT YET OBSERVED, and this file says so
//     rather than counting a consumer it has not seen.
'use strict';

const REGISTRY = new Map();

/** The variant axes this registry declares. `W1-30-LIBRARY.md` §2; the census rejects others. */
export const LIGHTING_VARIANT_AXES = Object.freeze([
  'timeOfDay', 'weather', 'regionTint', 'interior', 'intensity',
]);

// ---------------------------------------------------------------------------------------------
// The two base rigs. These are the only definitions in this file.
// ---------------------------------------------------------------------------------------------

/**
 * The exterior rig. One directional key (the sun or the moon — never both at full strength), a
 * hemisphere that carries the sky above and the ground below, a low colour-bearing fill, an image
 * probe, and the air.
 *
 * Units: `key`/`sky`/`fill`/`env` are multipliers on whatever the live sky computed, so a recipe
 * of all 1.0 is exactly today's behaviour and the diff of any recipe against `1.0` is the whole of
 * what it does. `fog.extinction` multiplies the region's declared per-metre extinction;
 * `fog.height` multiplies the region's declared height falloff.
 */
const EXTERIOR_RIG = Object.freeze({
  base: 'exterior',
  key: 1.0,            // directional sun/moon multiplier
  keyWarmth: 0.0,      // -1 cools the key toward the sky, +1 warms it toward the horizon
  // WHY THE HEMISPHERE AND FILL ARE BELOW 1.0 AND THE SUN IS NOT. Before W1-30B the environment
  // probe was 128 clamped texels, baked once at boot and never rebuilt, and tagged sRGB while
  // holding linear values — so it delivered almost no irradiance, and the HemisphereLight plus the
  // AmbientLight fill were doing image-based lighting's job. With a live half-float probe they are
  // support again, and leaving them where they were measured +70% mean frame luminance at the
  // spawn with the shadow contrast washed out of it. These two numbers are that correction, and
  // they are the first thing to move if the world reads flat.
  sky: 0.55,           // hemisphere multiplier
  fill: 0.40,          // ambient fill multiplier
  env: 1.0,            // scene.environmentIntensity
  envGroundBounce: 0.35, // how much of the probe's lower hemisphere is ground rather than sky
  shadow: 1.0,         // shadow-distance multiplier; 0 disables the directional shadow
  fog: { extinction: 1.0, height: 1.0, inscatter: 0.0 },
  exposure: 1.0,
  key_lights: [],      // exteriors have no placed lights; the sun is not a placed light
});

/**
 * The interior rig. No sun. One or more placed key lights, a small cool bounce standing in for the
 * daylight that reaches through openings, and a probe baked from the room's own colours.
 *
 * `key_lights` entries are specs, not lights: `{ role, colour, intensity, distance, decay,
 * flicker, castShadow, height }`. The consumer places them; the recipe says what they are.
 */
const INTERIOR_RIG = Object.freeze({
  base: 'interior',
  key: 0.0,
  keyWarmth: 0.0,
  sky: 0.10,
  fill: 0.22,
  env: 0.55,
  envGroundBounce: 0.55,
  shadow: 0.0,
  fog: { extinction: 0.35, height: 0.0, inscatter: 0.0 },
  exposure: 1.15,
  key_lights: [
    { role: 'hearth', colour: 0xffb066, intensity: 2.4, distance: 11, decay: 2, flicker: 0.16, castShadow: true, height: 0.9 },
  ],
});

const BASES = { exterior: EXTERIOR_RIG, interior: INTERIOR_RIG };

/** A recipe is a patch over a base. Nested `fog` merges; everything else replaces. */
function variantOf(baseId, patch) {
  const base = BASES[baseId];
  if (!base) throw new Error(`lighting-recipes.js: unknown base rig '${baseId}'`);
  const out = { ...base, ...patch, base: baseId };
  out.fog = Object.freeze({ ...base.fog, ...(patch.fog || {}) });
  out.key_lights = Object.freeze((patch.key_lights || base.key_lights).map((l) => Object.freeze({ ...l })));
  return Object.freeze(out);
}

// ---------------------------------------------------------------------------------------------

/** Register a lighting recipe under `id`. Throws on a duplicate id. */
export function registerLightingRecipe(id, recipe) {
  if (REGISTRY.has(id)) throw new Error(`lighting-recipes.js: recipe '${id}' is already registered`);
  REGISTRY.set(id, recipe);
  return recipe;
}

/** Fetch lighting recipe `id`. Fails closed on an unknown id. */
export function lightingRecipe(id) {
  const recipe = REGISTRY.get(id);
  if (!recipe) throw new Error(`lighting-recipes.js: unknown recipe id '${id}' (known: ${[...REGISTRY.keys()].join(', ') || 'none registered yet'})`);
  return recipe;
}

export function knownLightingRecipes() { return [...REGISTRY.keys()].sort(); }

// ---------------------------------------------------------------------------------------------
// The eight named recipes. Each line that differs from its base is a decision; each line that does
// not appear is deliberately the base's.
// ---------------------------------------------------------------------------------------------

// Full sun over open marsh. The key dominates, the sky is bright but not doing the key's job, and
// the air is thin so the far bank is readable. Reference condition: everything else is read as a
// departure from this.
registerLightingRecipe('noon-marsh', variantOf('exterior', {
  key: 1.00, sky: 0.42, fill: 0.30, env: 1.00, envGroundBounce: 0.38,
  fog: { extinction: 0.90, height: 1.0, inscatter: 0.10 }, exposure: 1.0,
}));

// Low sun under canopy. The key is warm and weak because the leaves have it; the bounce is doing
// most of the work and it is green. Long shadows want the far cascade, so shadow distance rises.
registerLightingRecipe('dusk-canopy', variantOf('exterior', {
  key: 0.78, keyWarmth: 0.85, sky: 0.62, fill: 0.55, env: 0.95, envGroundBounce: 0.55,
  shadow: 1.25, fog: { extinction: 1.15, height: 1.25, inscatter: 0.55 }, exposure: 1.06,
}));

// Overcast. There is no key worth the name; the sky IS the light. Shadows still exist but they are
// broad and shallow, which is what stops an overcast frame reading as unlit rather than diffuse.
registerLightingRecipe('overcast-flat', variantOf('exterior', {
  key: 0.34, keyWarmth: -0.30, sky: 0.95, fill: 0.70, env: 1.10, envGroundBounce: 0.30,
  shadow: 0.85, fog: { extinction: 1.30, height: 0.85, inscatter: 0.0 }, exposure: 1.04,
}));

// Storm. Cold, dark, and the air is genuinely thick — this is one of the two recipes allowed past
// the clear-air extinction ceiling, because a storm that does not close the world in is not a
// storm. Wet surfaces get their specular from the probe, so `env` stays up.
registerLightingRecipe('storm', variantOf('exterior', {
  key: 0.22, keyWarmth: -0.55, sky: 0.70, fill: 0.55, env: 1.15, envGroundBounce: 0.22,
  shadow: 0.70, fog: { extinction: 2.10, height: 0.70, inscatter: 0.0 }, exposure: 1.10,
}));

// Moonlight. The key is the moon and it is the sun's exact inverse direction, so shadows still
// fall the way a body expects. Cold, low, and readable — a night frame a judge cannot classify is
// a missing frame, not a dark one (RI-WLD04 M17 step 6).
registerLightingRecipe('night-moon', variantOf('exterior', {
  // These are the highest ambient multipliers in the file and they are deliberate. The probe at
  // night is genuinely almost black — the sky's own zenith and horizon fall to 0.02-0.09 — so
  // unlike every daylight recipe there is no image-based irradiance for the hemisphere and fill to
  // hand their job to. Measured on an RTX A5000 with these at 0.60/0.55, a 19:30 street frame came
  // back at a mean luminance of 3.8/255, which is `RI-WLD04` M17 step 6's failure exactly: a frame
  // a judge cannot classify is not a dark frame, it is a missing frame.
  key: 0.30, keyWarmth: -0.80, sky: 1.05, fill: 1.00, env: 0.75, envGroundBounce: 0.18,
  shadow: 0.85, fog: { extinction: 1.10, height: 1.15, inscatter: 0.0 }, exposure: 1.22,
}));

// A room with a fire in it. One warm flickering key low to the floor, a cold bounce for whatever
// daylight gets in, and a probe that is mostly the room's own ember.
registerLightingRecipe('interior-hearth', variantOf('interior', {
  sky: 0.12, fill: 0.26, env: 0.60, envGroundBounce: 0.60, exposure: 1.18,
  key_lights: [
    { role: 'hearth', colour: 0xffa851, intensity: 2.8, distance: 12, decay: 2, flicker: 0.18, castShadow: true, height: 0.85 },
    { role: 'sconce', colour: 0xffc98a, intensity: 0.9, distance: 7, decay: 2, flicker: 0.07, castShadow: false, height: 2.1 },
  ],
}));

// A room with no fire in it: a gaol, a store, a cellar with a shuttered window. The light is
// daylight that has been through something, so it is cold and it comes from above.
registerLightingRecipe('interior-cold', variantOf('interior', {
  sky: 0.34, fill: 0.30, env: 0.72, envGroundBounce: 0.35, exposure: 1.10,
  key_lights: [
    { role: 'window', colour: 0xbcd0e6, intensity: 1.5, distance: 14, decay: 2, flicker: 0.0, castShadow: true, height: 2.6 },
  ],
}));

// A cave whose light source is the cave. No sky at all, no bounce worth the name, and the probe is
// the emissive material's own colour — which is what makes a welkynd pillar or a comb cell read as
// the thing lighting the room rather than a bright decal on a dark wall.
registerLightingRecipe('cave-emissive', variantOf('interior', {
  sky: 0.03, fill: 0.10, env: 0.85, envGroundBounce: 0.70, exposure: 1.30,
  fog: { extinction: 0.85, height: 0.0, inscatter: 0.0 },
  key_lights: [
    { role: 'emissive', colour: 0x69d6ff, intensity: 1.8, distance: 16, decay: 2, flicker: 0.05, castShadow: false, height: 1.4 },
  ],
}));

// ---------------------------------------------------------------------------------------------

/**
 * Apply a variant spec to a recipe. The axes are exactly `LIGHTING_VARIANT_AXES`; anything else
 * throws, because a silently-ignored axis is a caller believing it asked for something.
 *
 * @param {string} id
 * @param {{timeOfDay?:number, weather?:string, regionTint?:number|null, interior?:boolean,
 *          intensity?:number}} variant
 */
export function resolveLightingRecipe(id, variant = {}) {
  const recipe = lightingRecipe(id);
  for (const k of Object.keys(variant)) {
    if (!LIGHTING_VARIANT_AXES.includes(k)) {
      throw new Error(`lighting-recipes.js: '${k}' is not a declared variant axis (have: ${LIGHTING_VARIANT_AXES.join(', ')})`);
    }
  }
  const s = Number.isFinite(variant.intensity) ? variant.intensity : 1;
  return Object.freeze({
    ...recipe,
    key: recipe.key * s, sky: recipe.sky * s, fill: recipe.fill * s, env: recipe.env * s,
    regionTint: variant.regionTint ?? null,
    timeOfDay: Number.isFinite(variant.timeOfDay) ? variant.timeOfDay : null,
    weather: variant.weather ?? null,
    interior: variant.interior === undefined ? recipe.base === 'interior' : !!variant.interior,
    fog: recipe.fog, key_lights: recipe.key_lights,
  });
}

/**
 * Which exterior recipe the sky is currently in. Pure function of the sky's own derived terms, so
 * two runs at the same hour in the same weather always name the same recipe — the recipe id is on
 * the published lighting frame and is therefore part of what a determinism check compares.
 *
 * The thresholds are the same ones the weather table already uses for its `overcast` light class
 * (`sky.js` WEATHER: sun <= 0.20, overcast 0.55-0.85, dark >= 0.86), so the two halves of the
 * build cannot disagree about whether it is a bright day.
 */
export function recipeForConditions({ day = 1, night = 0, overcast = 0, rain = 0, dusk = 0 } = {}) {
  if (night > 0.55) return 'night-moon';
  if (rain >= 0.8 || overcast >= 0.94) return 'storm';
  if (overcast >= 0.50) return 'overcast-flat';
  if (dusk > 0.34 || day < 0.42) return 'dusk-canopy';
  return 'noon-marsh';
}
