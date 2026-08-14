// W1-30S seam pass — new, empty registry.
//
// The architecture-kit registry for W1-30E (`render/exterior.js`, `render/places.js`): wall,
// corner, roof, door, window, stair, trim, awning, sign parts that a per-settlement grammar
// assembles (W1-30.md Part 2/4). Empty until W1-30E registers real kit parts; `kit()` fails
// closed on an unknown id, matching the fail-closed discipline the rest of the visual
// foundation already keeps (`worldMaterial`, `regionArt`, `settlementArt`). Future owner:
// W1-30E.
'use strict';

const REGISTRY = new Map();

/** Register a kit part factory under `id`. Throws on a duplicate id: a second definition of an
 * existing kit part is a variant spec against the first (directive §3), never a silent
 * overwrite. */
export function registerKit(id, factory) {
  if (typeof factory !== 'function') throw new Error(`registerKit('${id}') requires a factory function`);
  if (REGISTRY.has(id)) throw new Error(`kits.js: kit '${id}' is already registered`);
  REGISTRY.set(id, factory);
  return factory;
}

/** Build one instance of kit part `id`, optionally in `variant`. Fails closed on an unknown id. */
export function kit(id, variant) {
  const factory = REGISTRY.get(id);
  if (!factory) throw new Error(`kits.js: unknown kit id '${id}' (known: ${[...REGISTRY.keys()].join(', ') || 'none registered yet'})`);
  return factory(variant);
}

export function knownKits() { return [...REGISTRY.keys()].sort(); }
