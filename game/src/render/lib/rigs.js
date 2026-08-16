// The rig registry — W1-30D's half of `orchestration/plans/W1-30-LIBRARY.md`.
//
// THE OWNER'S EXAMPLE, MADE STRUCTURAL: *"if an agent finds an approach that produces a fantastic
// looking player character, can you reuse any of that approach for NPCs?"* The answer here is not
// "yes, please remember to" — it is that there is nowhere else for an NPC to come from. Two base
// body plans exist, both on one skeleton, and every character in the game is a VARIANT SPEC against
// one of them: an object of numbers, never a second definition. Improve `base.saxhleel` and every
// Saxhleel in Black Marsh improves in the same commit.
//
// WHAT A VARIANT MAY VARY, and the one axis that is deliberately missing.
//
//   morph     radii, ornament sizes, snout and crest — geometry, and it really does rebuild
//   material  palette, skin and cloth tint, wear
//   sockets   which equipment set is worn
//   clips     which clip set the character animates from
//   scale     a scale triple — HONOURED ONLY ON THE NON-COMBAT PATH, see below
//
// BONE LENGTHS ARE NOT A VARIANT AXIS, and this is a real constraint rather than an omission.
// `game/data/combat/skeleton.json` declares the rest offsets that `Rig.evaluate()` uses, and
// `hitgeometry.json` declares every hurtbox capsule as a segment OF a bone. Change a bone offset
// per character and the drawn body and the thing that can be hit stop being the same object —
// which is the defect `render/actor.js` was written to close. So a variant changes how thick, how
// crested, how snouted and what colour a character is; it does not change how long its forearm is.
//
// `scale` has the same problem in a smaller way: `poseFromRig` pins the actor group to identity
// because the bones carry world matrices, so a group scale would be silently dropped for anything
// with a combat body, and baking it into rest-space vertices would move the drawn surface off the
// hurtboxes. It is therefore applied only where it is safe and already in use — the static NPC
// path, where `renderer.js` already sets `mesh.scale`. Declared here so a caller knows which of the
// two it is getting rather than finding out from a screenshot.
'use strict';

export const SKELETON_ID = 'es.humanoid.v1';

/** The axes a variant spec may use. `library-census.mjs` reports `unknown` for anything else. */
export const VARIANT_AXES = Object.freeze(['morph', 'scale', 'material', 'sockets', 'clips']);

/** The morph keys a base understands, with their neutral value. A spec key outside this set is a
 *  typo, and a typo that silently does nothing is how twelve "distinct" characters turn out to be
 *  one character twelve times. */
export const MORPH_KEYS = Object.freeze({
  build: 1,          // multiplies every limb and trunk radius
  shoulders: 1,      // multiplies clavicle radius and chest width
  belly: 1,          // multiplies pelvis and lower-spine volume
  neck: 1,           // multiplies neck radius
  snout: 1,          // saxhleel: snout and jaw length
  crest: 1,          // saxhleel: head crest and dorsal crest size (0 removes it)
  horn: 1,           // saxhleel: brow horn size (0 removes them)
  hand: 1,           // hand and digit scale
  // THE CANON OF PROPORTION IS A MORPH AXIS, because it is the one number that made every figure
  // in the game read as slightly dwarfish and there was no way to say it. `W1-F10-CHARACTERS` C1,
  // measured over the 41 shipped figures: R = height/head ran 5.87-6.84, median 6.58, and **0 of
  // 41** sat in RI-VIS10's 7.0-8.0 band. `head` multiplies the whole cranial group about the head
  // bone's origin — skull, snout, jaw, crest, every facial landmark and the eye pieces — so a
  // variant can be long-headed or fine-headed without touching a bone offset, which is where the
  // hurtboxes live. The families carry a base scale of their own (`HEAD_SCALE` in actor.js); this
  // is the per-character multiplier on top of it.
  head: 1,
  // THE AGE AXIS, AND IT IS THE ONE THIS REGISTRY WAS MISSING. `RI-VIS10` E3 asks for four of
  // five body archetypes — child, slight, average, heavy, **stooped-old** — and the
  // `W1-F10-r12` critic's census recorded the reason only three were reachable: *"CHARACTER_SPECS
  // carries no spine curvature or age morph, so stooped-old cannot be reached by any shipped
  // row."* Read this turn, that was exactly true: every key above is a RADIUS multiplier, and no
  // multiplication of radii bends a back.
  //
  // NEUTRAL IS 0, NOT 1, because this is the one axis that is additive rather than
  // multiplicative — it is a curvature, and 1 would mean "one unit of stoop" on every character
  // that never asked for one. `resolveMorph` therefore leaves every existing row untouched.
  //
  // IT HAS TWO CONSUMERS AND BOTH ARE REQUIRED, which is why it is declared here rather than
  // being a private number inside `actor.js`:
  //   geometry  a dorsal mass over the upper spine, a narrowed shoulder span and a head set
  //             forward on the neck — all inside `buildSkeleton`, all bound to the bones that
  //             already own those regions, none of them touching a bone OFFSET (see the header:
  //             a bone offset is where the hurtboxes are).
  //   posture   a persistent forward curvature added into the stance layer that `poseStatic`
  //             already solves per person. A hump with an upright carriage reads as a costume;
  //             a curvature with no mass reads as a man leaning.
  // A stoop that were only one of the two would be half a person, and a critic reading only the
  // geometry half would correctly say the age axis is a bump.
  stoop: 0,
});

const RIGS = new Map();
const CHARACTERS = new Map();

/** Register a rig/body-plan factory under `id`. Throws on a duplicate id. */
export function registerRig(id, factory, meta = {}) {
  if (typeof factory !== 'function') throw new Error(`registerRig('${id}') requires a factory function`);
  if (RIGS.has(id)) throw new Error(`rigs.js: rig '${id}' is already registered`);
  RIGS.set(id, { factory, meta: { skeleton: SKELETON_ID, ...meta } });
  return factory;
}

/** Build rig `id`, optionally in `variant`. Fails closed on an unknown id or an unknown axis. */
export function rig(id, variant) {
  const entry = RIGS.get(id);
  if (!entry) throw new Error(`rigs.js: unknown rig id '${id}' (known: ${[...RIGS.keys()].join(', ') || 'none registered yet'})`);
  if (variant) validateVariant(id, variant);
  return entry.factory(variant);
}

export function knownRigs() { return [...RIGS.keys()].sort(); }
export function rigMeta(id) { const e = RIGS.get(id); return e ? e.meta : null; }

/** Fail closed on an axis or morph key the registry does not declare. */
export function validateVariant(baseId, variant) {
  for (const k of Object.keys(variant)) {
    if (!VARIANT_AXES.includes(k)) {
      throw new Error(`rigs.js: variant of '${baseId}' uses axis '${k}', which the registry does not `
        + `declare (axes: ${VARIANT_AXES.join(', ')}).`);
    }
  }
  for (const k of Object.keys(variant.morph || {})) {
    if (!(k in MORPH_KEYS)) {
      throw new Error(`rigs.js: variant of '${baseId}' uses morph key '${k}', which no base understands `
        + `(keys: ${Object.keys(MORPH_KEYS).join(', ')}). A morph key that does nothing is a variant that is not one.`);
    }
  }
  return variant;
}

/** Fill a partial morph out to the full neutral set, so a base never reads an undefined multiplier. */
export function resolveMorph(morph) {
  const out = { ...MORPH_KEYS };
  for (const [k, v] of Object.entries(morph || {})) if (k in out) out[k] = Number(v);
  return out;
}

/**
 * A named character. `base` must be a registered rig; everything else is a variant spec.
 * This is the list D's acceptance counts, and the census reads it to find copies.
 */
export function registerCharacter(id, spec) {
  if (CHARACTERS.has(id)) throw new Error(`rigs.js: character '${id}' is already registered`);
  if (!spec || !spec.base) throw new Error(`rigs.js: character '${id}' names no base`);
  const { base, ...variant } = spec;
  validateVariant(base, variant);
  CHARACTERS.set(id, spec);
  return spec;
}

export function character(id) {
  const c = CHARACTERS.get(id);
  if (!c) throw new Error(`rigs.js: unknown character '${id}' (known: ${[...CHARACTERS.keys()].join(', ') || 'none'})`);
  return c;
}
export function knownCharacters() { return [...CHARACTERS.keys()].sort(); }
export function charactersOf(baseId) { return [...CHARACTERS.entries()].filter(([, c]) => c.base === baseId).map(([id]) => id).sort(); }

/** The stable structural identity of a (base, variant) pair — the census hashes it to find copies
 *  masquerading as variants, exactly as `materialVariantKey` does for materials. */
export function variantKey(baseId, variant = {}) {
  const m = resolveMorph(variant.morph);
  const mat = variant.material || {};
  return `${baseId}|m=${Object.entries(m).map(([k, v]) => `${k}:${Number(v).toFixed(3)}`).join(',')}`
    + `|mat=${mat.palette ?? '-'}:${mat.skin ?? '-'}:${mat.cloth ?? '-'}:${Number(mat.wear ?? 0).toFixed(2)}`
    + `|sk=${(variant.sockets && variant.sockets.set) || '-'}|cl=${variant.clips || '-'}`;
}

/**
 * The census this registry owes `W1-30-LIBRARY.md` §4.
 *
 * `duplicate` is the row that matters: two "different" characters with the same structural key are
 * one character wearing two names, and counting them as two is precisely the way a reuse gate gets
 * passed without reuse happening.
 */
export function rigCensus() {
  const bases = knownRigs();
  const seen = new Map();
  const duplicate = [];
  const orphanBase = [];
  for (const [id, spec] of CHARACTERS) {
    if (!RIGS.has(spec.base)) orphanBase.push(`${id} -> ${spec.base}`);
    const k = variantKey(spec.base, spec);
    if (seen.has(k)) duplicate.push(`${seen.get(k)} == ${id}`); else seen.set(k, id);
  }
  const perBase = {};
  for (const b of bases) perBase[b] = charactersOf(b).length;
  const unusedBase = bases.filter((b) => perBase[b] < 2);
  return {
    skeleton: SKELETON_ID,
    bases: bases.length, baseIds: bases,
    characters: CHARACTERS.size,
    distinctVariants: seen.size,
    perBase,
    duplicate,
    orphanBase,
    singleConsumerBases: unusedBase,
    pass: duplicate.length === 0 && orphanBase.length === 0,
  };
}
