// W1-30S seam pass — new, empty registry.
//
// Named lighting recipes for W1-30B (`render/sky.js`, `render/lighting.js`) — the sun/shadow/
// IBL/exposure preset a region or interior asks for by name rather than by re-deriving numbers
// per call site. Empty until W1-30B registers real recipes; `lightingRecipe()` fails closed on
// an unknown id. Future owner: W1-30B.
'use strict';

const REGISTRY = new Map();

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
