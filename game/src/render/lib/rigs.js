// W1-30S seam pass — new, empty registry.
//
// Named rig/body-plan variants for W1-30D (`render/actor.js`, `render/models.js`) — the base
// humanoid and base Saxhleel mesh, and every NPC/creature as a registered variant of one of
// them (W1-30.md Part 4's reuse requirement: one base per species, not one mesh per NPC).
// Empty until W1-30D registers real rigs; `rig()` fails closed on an unknown id. Future owner:
// W1-30D.
'use strict';

const REGISTRY = new Map();

/** Register a rig/body-plan factory under `id`. Throws on a duplicate id. */
export function registerRig(id, factory) {
  if (typeof factory !== 'function') throw new Error(`registerRig('${id}') requires a factory function`);
  if (REGISTRY.has(id)) throw new Error(`rigs.js: rig '${id}' is already registered`);
  REGISTRY.set(id, factory);
  return factory;
}

/** Build rig `id`, optionally in `variant`. Fails closed on an unknown id. */
export function rig(id, variant) {
  const factory = REGISTRY.get(id);
  if (!factory) throw new Error(`rigs.js: unknown rig id '${id}' (known: ${[...REGISTRY.keys()].join(', ') || 'none registered yet'})`);
  return factory(variant);
}

export function knownRigs() { return [...REGISTRY.keys()].sort(); }
