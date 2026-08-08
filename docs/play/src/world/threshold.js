// The province's border markers, as numbers. W1-02 round 2, `RI-WLD12` M64 / M66 / M68.
//
// `game/data/world/borders.json` places 210 threshold objects of eight types across the 24
// borders, and seven pieces of `announcement.remains` on the borders where the danger tier jumps
// by two or more. Round 1 built the placement and its own handover said the objects "have no
// MESH ... nothing for cairns, root-gates, tide-poles or the corpse in a cage". That is
// `RI-MTH07` §A's orphan-data shape: coordinates nobody draws and nobody collides with.
//
// This file is the half of the answer that has no renderer in it, so that `world/field.js` and
// `sim/traversal.js` (node, tools, no THREE) and `world/province.js` (browser) share ONE
// definition of how wide a cairn stands and whether you can walk through it. The meshes are in
// `threshold-geo.js` and are built from these same numbers — a marker cannot be solid in the
// collision and hollow in the frame, which is the split that let the last four systems drift.
//
// It matters because of what the map is now allowed to be. Seam S35 says the map records only
// ground the player has already walked: no marker, no route, nothing a quest can place on it. The
// map cannot tell you that you are leaving Blackwood for the Deep Marshes. The border has to.
'use strict';

/**
 * Per-type footprint and look. `h` is NOT here — `borders.json`'s `threshold_vocabulary[type].h`
 * is authoritative for height and is what the instancing scales by — but `r` and `solid_r` are,
 * because nothing else in the project declares them.
 *
 *  r        horizontal half-extent in metres at height 1, so world radius is r * h
 *  solid_r  radius the player's capsule is pushed out of, in metres, at the instance's real size;
 *           0 means you can walk through it (a bone line and a slag heap are steppable)
 *  glow     night emission, 0..1. Half of every day is dark and a marker you cannot see at
 *           night is a marker for half a world.
 */
export const THRESHOLD_KINDS = {
  imperial_border_cairn: {
    r: 0.62, solid_r: 0.85, glow: 0, colour: '#BFB9A6', roughness: 0.78,
    note: 'stacked drums, leaning, one block already down at the foot',
  },
  root_gate: {
    r: 0.55, solid_r: 0, glow: 0, colour: '#6B5230', roughness: 0.86,
    note: 'two roots crossing above head height, hung with strands; grown, not built',
  },
  tide_pole: {
    r: 0.34, solid_r: 0.30, glow: 0, colour: '#7E6B4F', roughness: 0.84,
    note: 'notched mast with a crossbar at each remembered tide, rag at the head',
  },
  knife_marked_stem: {
    r: 0.40, solid_r: 0.40, glow: 0, colour: '#33291F', roughness: 0.93,
    note: 'three thorn stems lashed into a tripod, the inner faces blazed',
  },
  kiln_slag_heap: {
    r: 1.55, solid_r: 0, glow: 0.45, colour: '#4B3B33', roughness: 0.42, glow_hex: '#FF6A22',
    note: 'a low glassed spoil-mound with clinker still hot in it',
  },
  bone_line: {
    r: 1.30, solid_r: 0, glow: 0, colour: '#D8D2BE', roughness: 0.70,
    note: 'five ribs off something big, set upright in a row, all curving the same way',
  },
  salt_glass_marker: {
    r: 0.85, solid_r: 0, glow: 0.30, colour: '#DCE8EE', roughness: 0.14, metalness: 0.34,
    glow_hex: '#BFE6FF',
    note: 'a branched fulgurite the crater-fields made; nobody put it here',
  },
  corpse_in_a_cage: {
    r: 0.75, solid_r: 0.50, glow: 0, colour: '#2E2A24', roughness: 0.88,
    note: 'a gibbet arm, a hooped cage, and what the Dres left in it',
  },
};

/**
 * The four `announcement.remains` kinds, keyed by the exact prose `borders.json` stores, because
 * that string is the join and a second spelling of it would be a silent miss.
 */
export const REMAINS_KINDS = {
  // `h` scales the unit geometry; `r` is that geometry's own half-extent at height 1, so world
  // radius is r * h and the bucket reach is honest about how far the thing sticks out.
  "a poler's barge, holed and dragged above the waterline":
    { id: 'barge', h: 2.4, r: 1.05, colour: '#4A3A2C', roughness: 0.90 },
  'a cairn of legion tesserae with no bodies under it':
    { id: 'tesserae', h: 1.6, r: 0.55, colour: '#9C9482', roughness: 0.70 },
  'dye-stained wrappings and a picked ribcage':
    { id: 'wrappings', h: 1.5, r: 0.80, colour: '#8E3040', roughness: 0.82 },
  'a salt-cured pack-guar, still loaded':
    { id: 'guar', h: 1.9, r: 1.10, colour: '#6E6250', roughness: 0.80 },
};

/** Stable per-instance variation from the instance's own coordinates — no RNG, no frame order. */
export function thresholdJitter(x, z) {
  let h = Math.imul(Math.round(x * 4) | 0, 374761393) ^ Math.imul(Math.round(z * 4) | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return {
    rot: (h % 6283) / 1000,                    // 0 .. 2pi
    scale: 0.86 + ((h >>> 13) % 1000) / 1000 * 0.30,  // 0.86 .. 1.16
  };
}

/**
 * Every drawable border marker in the province, flattened out of `borders.json` — one row per
 * object, plus one row per tier-jump remains. Shared by the renderer, the collision index and
 * `tools/world/threshold-consumption.mjs`, so all three count the same things.
 *
 * @param {object} doc  game/data/world/borders.json
 * @returns {Array<{type:string,x:number,z:number,h:number,r:number,solid_r:number,glow:number,
 *                  border:string,owner:string,remains:boolean,rot:number,scale:number}>}
 */
export function thresholdInstances(doc) {
  const out = [];
  if (!doc || !Array.isArray(doc.borders)) return out;
  const vocab = doc.threshold_vocabulary || {};
  for (const b of doc.borders) {
    for (const o of b.threshold_objects || []) {
      const K = THRESHOLD_KINDS[o.type];
      const V = vocab[o.type];
      if (!K || !V) continue;                  // a type with no shape is not silently drawn as a box
      const j = thresholdJitter(o.x, o.z);
      const h = V.h * j.scale;
      out.push({
        type: o.type, x: o.x, z: o.z, h,
        r: K.r * h, solid_r: K.solid_r * j.scale, glow: K.glow,
        border: b.id, owner: V.owner, remains: false, rot: j.rot, scale: j.scale,
      });
    }
    const rm = b.announcement && b.announcement.remains;
    if (rm && REMAINS_KINDS[rm.kind]) {
      const R = REMAINS_KINDS[rm.kind];
      const j = thresholdJitter(rm.x, rm.z);
      const h = R.h * j.scale;
      out.push({
        type: R.id, x: rm.x, z: rm.z, h,
        r: R.r * h, solid_r: 0, glow: 0,
        border: b.id, owner: rm.kind, remains: true, rot: j.rot, scale: j.scale,
      });
    }
  }
  return out;
}
