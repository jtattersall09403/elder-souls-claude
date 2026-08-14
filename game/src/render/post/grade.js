// W1-30A — the colour grade. Owned by W1-30A (`render/post/**`).
//
// WHAT WAS HERE BEFORE: nothing. The composite's entire "grade" was
//   `c = mix(vec3(luma), c, 1.035)` — a 3.5% saturation nudge, a 1.5% contrast nudge and a
// 7.5% vignette. That is not a grade; it is a rounding error with a comment. Every region of
// Black Marsh, at every hour, in every weather, came out of the frame the same colour, which is
// why `game/data/world/regions.json` can give Blackwood `#1F2E1C / #4A3423 / #C9A54B` and the
// Stone Wastes `#DCD2B8 / #8C5A3A / #EDEDE6` and a player cannot tell them apart from a still.
//
// THE SHAPE, and why it is this shape. The plan (`orchestration/plans/W1-30A.md` §5) is explicit:
// "grade recipes are variant specs over a base curve, one per region x weather — never 78 separate
// transforms." So there is exactly ONE curve here, and everything else is a small, named,
// readable delta on it:
//
//     base curve  ->  region variant  ->  time-of-day variant  ->  weather variant
//
// and the four compose by simple accumulation, so any single one of them can be zeroed and the
// effect of the others is unchanged. That matters for the null controls: "swap every region to
// one recipe and the distinguishability must collapse" is a one-line call here
// (`resolveGrade({ ..., forceRegion: 'neutral' })`), not a code edit.
//
// THE ONE RULE THAT KEEPS A GRADE FROM BECOMING AN EXPOSURE BUG. Every tint below is
// **normalised to unit mean before use** (`tint()`), so a recipe can say "the shadows here are
// the colour of wet bark" without also saying "and the frame is 30% darker". A grade that dims
// is indistinguishable from a grade that is wrong, and the previous attempt at atmosphere in
// this project was exactly that mistake at the exposure level (see `renderer.js`'s
// `toneMappingExposure` comment).
//
// WHERE THE NUMBERS COME FROM. `palette_hex` and `sky` in `game/data/world/regions.json`, which
// the world corpus already authored per region, plus the region's one-line `climate`. They are
// not invented here; they are *applied* here, which is the defect this file closes. The ids below
// are checked against the shipped region list by `tools/render/w1-30a-grade-census.mjs`, so a
// region added to the corpus and forgotten here is a red gate rather than a silent neutral frame.
'use strict';

/** sRGB hex -> [r,g,b] in 0..1. Display-referred on purpose: the creative grade runs after the
 * tonemap and after the colour-space transform, which is where lift/gamma/gain and split-toning
 * are defined. The white balance, which is a *physical* operation, runs before the tonemap. */
export function hexRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** A tint, normalised to unit mean, then pulled `strength` of the way from neutral toward it.
 * `tint('#1F2E1C', 1)` has mean exactly 1.0, so multiplying by it rotates hue and leaves
 * luminance alone. This is the single most important line in the file. */
export function tint(hex, strength = 1) {
  const c = hexRgb(hex);
  const mean = (c[0] + c[1] + c[2]) / 3 || 1;
  return c.map((v) => 1 + ((v / mean) - 1) * strength);
}

// ---- the base curve -----------------------------------------------------------------------
// One curve, applied to every frame in the game. Deliberately conservative: the region variants
// are what should be noticeable, not this. `contrast` pivots at 0.42 rather than 0.5 because the
// province spends most of its frames below mid-grey (heavy fog, canopy, night) and pivoting at
// 0.5 crushed those frames while doing nothing to a noon vista.
export const BASE_CURVE = {
  lift: 0.004,          // a hair of black lift: film never has a true 0, and it stops the
                        // shadow tint below from having nothing to tint.
  gain: 1.0,
  gamma: 1.0,
  contrast: 1.10,
  pivot: 0.42,
  saturation: 1.10,
  vignette: 0.20,       // was 0.075 — invisible. This one is seen, and it is still gentle.
  vignetteInner: 0.38,
  vignetteOuter: 0.98,
  balance: 1.30,        // split-tone pivot exponent: >1 pushes the shadow tint further up the ramp
  shadowStrength: 0.34,
  highlightStrength: 0.24,
  warmth: 0.0,          // linear white balance, -1 cool .. +1 warm, applied pre-tonemap
};

// ---- region variants ----------------------------------------------------------------------
// One row per shipped region. `shadow`/`highlight` are corpus `palette_hex` entries; `sky` is the
// corpus horizon where the white balance should sit. The scalar deltas are art direction and are
// meant to be argued with — each carries the corpus `climate` line that justifies it.
const REGION = {
  blackwood: { shadow: '#1F2E1C', highlight: '#C9A54B', warmth: -0.05, sat: -0.10, contrast: +0.10, vignette: +0.10,
    why: 'heavy rain; light arrives only in shafts — deep green shadow, the one gold that breaks through' },
  'clay-moor': { shadow: '#9C5B3C', highlight: '#C8BFA8', warmth: +0.16, sat: +0.06, contrast: -0.02, vignette: -0.04,
    why: 'dry; dust-devils; heat shimmer — everything is baked clay and airborne dust' },
  'crimson-coast': { shadow: '#232021', highlight: '#8E2B33', warmth: +0.04, sat: +0.10, contrast: +0.08, vignette: +0.04,
    why: 'sea-squalls off the Padomaic — near-black rock, and the red the coast is named for' },
  'deep-marshes': { shadow: '#16191A', highlight: '#3B5A3A', warmth: -0.14, sat: -0.06, contrast: +0.04, vignette: +0.14,
    why: 'green fever-fog carrying a named disease — the sickest, coldest, most closed-in frame we ship' },
  'eastern-rootlands': { shadow: '#2A211A', highlight: '#4F7A5E', warmth: -0.04, sat: +0.08, contrast: +0.02, vignette: +0.02,
    why: 'night bioluminescence turns the water into a second sky — saturated green, cool' },
  hive: { shadow: '#9A6B2F', highlight: '#E6E2D0', warmth: +0.20, sat: -0.04, contrast: -0.06, vignette: +0.06,
    why: 'always warm and still; rain does not fall inside the hive air — flat, waxy, amber' },
  'marauders-coast': { shadow: '#2C3A2E', highlight: '#B7BFC0', warmth: -0.10, sat: -0.14, contrast: -0.04, vignette: +0.08,
    why: 'sea-fog banks on a ~6 minute cycle — the most desaturated exterior in the province' },
  'salt-hills': { shadow: '#7D8B5C', highlight: '#C6D2DA', warmth: -0.12, sat: -0.02, contrast: +0.04, vignette: -0.02,
    why: 'cold rain; snow on unreachable peaks — high, blue, clean' },
  'stone-forest': { shadow: '#3D5A3A', highlight: '#B8712C', warmth: +0.08, sat: +0.04, contrast: +0.12, vignette: -0.06,
    why: 'clear high light; sudden dry thunder with no rain — the hardest light we have' },
  'stone-wastes': { shadow: '#8C5A3A', highlight: '#EDEDE6', warmth: +0.10, sat: -0.16, contrast: -0.08, vignette: +0.02,
    why: 'salt-storms, visibility to 15 m — blown-out white, almost no colour left in it' },
  thornmarsh: { shadow: '#241E1C', highlight: '#B49A82', warmth: +0.02, sat: -0.18, contrast: +0.02, vignette: +0.10,
    why: 'grey ash carried south from Morrowind, dusting every surface — ash kills chroma' },
  'valus-ridge': { shadow: '#4E6B3C', highlight: '#A8BDC8', warmth: -0.16, sat: -0.04, contrast: +0.06, vignette: -0.08,
    why: 'cold rain, cloud BELOW the player on high paths — thin cold air, wide open' },
  'western-rootlands': { shadow: '#6B5638', highlight: '#C4CFB8', warmth: +0.06, sat: +0.04, contrast: 0.0, vignette: 0.0,
    why: 'warm rain; dawn mist — the friendliest region, and the closest thing to the base curve' },
  // The null control. `resolveGrade({ forceRegion: 'neutral' })` swaps every region to this and
  // the "grade separates places" gate must collapse. It is a row, not a code path, on purpose:
  // a control that runs through different code from the thing it controls proves nothing.
  neutral: { shadow: '#808080', highlight: '#808080', warmth: 0, sat: 0, contrast: 0, vignette: 0,
    why: 'null control — the plausible wrong answer: a real grade that is the SAME real grade everywhere' },
  // Interiors are lit by what is burning in them, so they get one recipe and the region does not
  // reach inside. `renderer.js` selects this when `cell !== "province"` and an interior is loaded.
  interior: { shadow: '#241A12', highlight: '#E0B071', warmth: +0.24, sat: +0.02, contrast: +0.14, vignette: +0.16,
    why: 'hearth and lamp: everything indoors is lit by fire, so the highlights carry the flame' },
};

// ---- time-of-day variants -------------------------------------------------------------------
// Driven by `lighting.js`'s frame scalars (`day`, `dusk`, `night`), which are continuous, so these
// blend rather than switch. There is no "dawn" row: `dusk` in `sky.js` is symmetric about noon and
// covers both ends, which is a simplification worth naming rather than hiding.
const TIME = {
  day: { warmth: 0, sat: 0, contrast: 0, vignette: 0, lift: 0 },
  dusk: { warmth: +0.22, sat: +0.14, contrast: +0.10, vignette: +0.08, lift: +0.004 },
  night: { warmth: -0.26, sat: -0.26, contrast: +0.06, vignette: +0.16, lift: +0.010 },
};

// ---- weather variants -------------------------------------------------------------------------
// `overcast` is the single scalar `lighting.js` publishes for "how much cloud is between the sun
// and the ground". Rain and fog both raise it, so one axis covers both and there is no second,
// separately-tunable knob to fall out of sync with the sky.
const WEATHER = {
  overcast: { warmth: -0.10, sat: -0.14, contrast: -0.10, vignette: +0.04, lift: +0.008 },
};

// ---- registry ---------------------------------------------------------------------------------
// Published for reuse (directive §3). `W1-30B` owns `lib/lighting-recipes.js` for *lighting*
// recipes; this is the *grade* registry and it is A's. Any other visual child that needs the
// game's colour identity — the Deck's reference plates, a settings preview, a map illustration —
// calls `resolveGrade()` rather than inventing its own numbers.
const EXTRA = new Map();

/** Register a grade recipe under `id`. Throws on a duplicate id (including a shipped region). */
export function registerGradeRecipe(id, recipe) {
  if (REGION[id] || EXTRA.has(id)) throw new Error(`grade.js: recipe '${id}' is already registered`);
  EXTRA.set(id, recipe);
  return recipe;
}

/** Fetch grade recipe `id`. Fails closed on an unknown id. */
export function gradeRecipe(id) {
  const r = REGION[id] || EXTRA.get(id);
  if (!r) throw new Error(`grade.js: unknown grade recipe '${id}' (known: ${knownGradeRecipes().join(', ')})`);
  return r;
}

export function knownGradeRecipes() { return [...Object.keys(REGION), ...EXTRA.keys()].sort(); }

/** Region ids this module carries a variant for, excluding the two non-region rows. Used by the
 * census tool to prove the table has not drifted from `game/data/world/regions.json`. */
export function gradedRegionIds() {
  return Object.keys(REGION).filter((k) => k !== 'neutral' && k !== 'interior').sort();
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Resolve the frame's grade to a flat block of shader uniforms.
 *
 * @param {object} f
 * @param {string|null} f.regionId    region under the camera, or null outside the province
 * @param {boolean}     f.interior    true when the camera is inside a loaded interior
 * @param {number}      f.day         0..1, `lighting.js`
 * @param {number}      f.dusk        0..1
 * @param {number}      f.night       0..1
 * @param {number}      f.overcast    0..1
 * @param {string|null} f.forceRegion null control: pin every region to this recipe
 * @returns {{lift:number[],gain:number[],invGamma:number[],shadowTint:number[],highlightTint:number[],
 *            balance:number,contrast:number,pivot:number,saturation:number,vignette:number,
 *            vignetteInner:number,vignetteOuter:number,mix:number[],recipe:string}}
 */
export function resolveGrade(f = {}) {
  const B = BASE_CURVE;
  const id = f.forceRegion || (f.interior ? 'interior' : (f.regionId && (REGION[f.regionId] || EXTRA.get(f.regionId)) ? f.regionId : 'western-rootlands'));
  const R = gradeRecipe(id);

  const day = clamp01(Number(f.day) || 0);
  const dusk = clamp01(Number(f.dusk) || 0);
  const night = clamp01(Number(f.night) || 0);
  const oc = clamp01(Number(f.overcast) || 0);
  // Interiors do not get a day/night grade from the sky: a hearth room at 03:00 and at 13:00 is
  // the same room lit by the same fire, and grading it by the sun is how an interior ends up
  // blue at night for no reason a player can see.
  const tw = f.interior && !f.forceRegion ? { day: 1, dusk: 0, night: 0 } : { day, dusk, night };

  const acc = (key) => (TIME.day[key] * tw.day + TIME.dusk[key] * tw.dusk + TIME.night[key] * tw.night)
    + WEATHER.overcast[key] * oc * (f.interior ? 0 : 1);

  const warmth = B.warmth + (R.warmth || 0) + acc('warmth');
  const saturation = Math.max(0, B.saturation + (R.sat || 0) + acc('sat'));
  const contrast = Math.max(0.2, B.contrast + (R.contrast || 0) + acc('contrast'));
  const vignette = Math.max(0, B.vignette + (R.vignette || 0) + acc('vignette'));
  const lift = B.lift + acc('lift');

  // Tint strengths fade with how much of the frame the region actually owns: at full night the
  // region's daylight palette is mostly not being lit, so leaning on it produces a colour cast
  // over nothing. Shadows keep their tint (they are all that is left); highlights lose most of it.
  const shadowTint = tint(R.shadow, B.shadowStrength);
  const highlightTint = tint(R.highlight, B.highlightStrength * (1 - 0.55 * night));

  // White balance, pre-tonemap, as a real 3x3 channel mixer rather than a per-channel scale, so
  // it can move a hue and not only a temperature. Off-diagonal terms are small and symmetric-ish;
  // at warmth 0 this is exactly the identity, which is what makes it a testable null.
  const w = warmth;
  const mix = [
    1 + 0.12 * w, 0.05 * w, -0.04 * w,
    0.02 * w, 1 + 0.01 * w, -0.02 * w,
    -0.05 * w, -0.03 * w, 1 - 0.13 * w,
  ];

  return {
    recipe: id,
    lift: [lift, lift, lift],
    gain: [B.gain, B.gain, B.gain],
    invGamma: [1 / B.gamma, 1 / B.gamma, 1 / B.gamma],
    shadowTint, highlightTint,
    balance: B.balance,
    contrast, pivot: B.pivot, saturation,
    vignette, vignetteInner: B.vignetteInner, vignetteOuter: B.vignetteOuter,
    mix,
  };
}

/**
 * Ease one resolved grade toward another, term by term, at rate `k` per frame.
 *
 * Region boundaries in `field.regionAt()` are a raster edge: one step across it and the recipe
 * changes between consecutive frames. Snapping there is a cut in the middle of a walk, which is
 * more distracting than having no grade at all. `k = 0.10` converges to within a percent in about
 * 45 frames — three quarters of a second at 60 Hz, slow enough to be unnoticed and fast enough
 * that a player who runs into Blackwood is in Blackwood's colour before they have stopped.
 *
 * `recipe` is taken from the target, not eased: it is a label, and a half-eased frame belongs to
 * where the camera IS.
 */
export function easeGrade(a, b, k) {
  const l = (x, y) => x + (y - x) * k;
  const v = (x, y) => x.map((c, i) => l(c, y[i]));
  return {
    recipe: b.recipe,
    lift: v(a.lift, b.lift), gain: v(a.gain, b.gain), invGamma: v(a.invGamma, b.invGamma),
    shadowTint: v(a.shadowTint, b.shadowTint), highlightTint: v(a.highlightTint, b.highlightTint),
    mix: v(a.mix, b.mix),
    balance: l(a.balance, b.balance), contrast: l(a.contrast, b.contrast), pivot: l(a.pivot, b.pivot),
    saturation: l(a.saturation, b.saturation),
    vignette: l(a.vignette, b.vignette),
    vignetteInner: l(a.vignetteInner, b.vignetteInner), vignetteOuter: l(a.vignetteOuter, b.vignetteOuter),
  };
}

/** The grade that is exactly "do nothing". Not a recipe — the OFF state for the sabotage switch,
 * used by `setVisualFeature('grade', false)`. Identity in every term, so the null control for the
 * whole grade is a real code path and not a second implementation. */
export function identityGrade() {
  return {
    recipe: 'off',
    lift: [0, 0, 0], gain: [1, 1, 1], invGamma: [1, 1, 1],
    shadowTint: [1, 1, 1], highlightTint: [1, 1, 1],
    balance: 1, contrast: 1, pivot: 0.5, saturation: 1,
    vignette: 0, vignetteInner: 0.38, vignetteOuter: 0.98,
    mix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  };
}
