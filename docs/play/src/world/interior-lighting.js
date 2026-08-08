// THE ONE PLACE THAT DECIDES WHAT A ROOM IS LIT BY.
//
// Owner: wave-1 piece W1-15, round 4. Read by `render/interior.js` (what the player SEES) and by
// `sim/stealth/system.js` (what the game SIMULATES). Neither may make a lighting policy decision
// of its own; both call in here.
//
// ---- WHY THIS FILE EXISTS ---------------------------------------------------------------------
//
// Round 3 made the authored lamps reach the detection model and was right that there is only one
// lamp LIST: `interiors/*.json`'s `lights[]`, reached by the renderer as `rec.lights` and by the
// sim through `sim.settlements.interior(id)` — one object, one reference, no copy to drift. The
// round-3 critic confirmed that at the data layer and then found `RULES.md` rule 10 reintroduced
// one layer up, in the POLICY each file applied to that shared list:
//
//   | | render/interior.js | sim/stealth/system.js |
//   | how many illuminate | the first LIT_CAP = 5 | all of them |
//   | a room declaring NO lamp | invents a hearth so the frame is not black | nothing; ambient 0.04 |
//
// Measured over all 115 interiors on a 1 m chest-height grid, 22,751 indoor floor cells:
// **1,659 cells (7.29%) disagreed** about whether a player standing there is in shadow, of which
// **1,584 were DRAWN LIT AND SIMULATED PITCH BLACK** — in eleven rooms (the ten hand-authored
// Helstrom cells and the writ-house) that declare no `lights[]` at all. Those eleven were a
// REGRESSION: before round 3 they read `skyAmbient()` (0.75 at noon); after it they read 0.0400 at
// every hour, which is `light_table_L`'s `unlit` row — the value for a sealed xanmeer depth. The
// critic's screenshot of one of them shows hearth light on the beams, two windows bright enough to
// read by and three people you can see clearly, at L 0.0400. A player standing in that frame was
// visibly lit and mechanically invisible.
//
// ---- THE RULING, AND IT IS REVERSIBLE ---------------------------------------------------------
//
// The brief allowed three answers: the renderer stops capping, the sim adopts the cap, or both
// read a third thing. **Both read a third thing, and the third thing does not cap.**
//
//   1. `LIT_CAP` is GONE as an illumination cap. Its stated justification is a rendering budget —
//      "591 shadow-casting oil lamps across the province is a slideshow" — and that number is
//      never simultaneous: exactly one interior is built at a time, and the worst room in the
//      corpus declares 14 deduped lamps. The cap was therefore protecting against 14 point
//      lights, not 591, and it was buying that at the cost of nine visible lamp meshes in the
//      worst room emitting nothing. The SHADOW cap is the part that was ever real, and it stays
//      exactly as it was: the first light in a room casts a shadow map and no other one does.
//      REVERSIBLE: a measured frame-time regression attributable to >5 point lights in one room
//      sends the cap back — and it goes back HERE, where both readers get it at once.
//   2. The fail-open hearth MOVES IN HERE rather than being deleted, so a room declaring no
//      `lights[]` is lit identically on both sides. It is flagged `synthesized: true` so a census
//      can tell an authored lamp from a rescue, and `interiorsMissingLights()` below names the
//      eleven rooms whose data ought to be authored instead.
//
// ---- AND THE AMBIENT IS RE-DERIVED FROM ROOMS THAT EXIST --------------------------------------
//
// `detection.json` justified dropping indoor ambient to 0.04 with "a windowless cellar at noon
// sampled L=1.00". There are no cellars. `WINDOWLESS` is `{prison, hold}` and it matches exactly
// **3 of 115** interiors (`blackrose-prison`, `stormhold-gaol`, `barge-hold`); the other **112 are
// drawn with up to eight windows**, and nothing in the build read one. A constant defended by a
// category that does not exist is not derived, it is asserted.
//
// So the ambient is now a function of the aperture the renderer actually draws:
//
//     ambient_L(rec, skyL) = unlit_L + skyL * DAYLIGHT_K * (glazed_area_m2 / floor_area_m2)
//
// with the windowless three pinned at `unlit_L` — which is now the row's HONEST use, because
// `unlit interior / xanmeer depth` is exactly what a gaol and a barge hold are.
//
// `DAYLIGHT_K` is derived, not fitted. The aperture ratio over the shipped 115 runs 0.0200 to
// 0.03226 (a 0.9 x 0.8 m pane, up to eight of them, against `bounds_m`'s own floor area). The
// anchor is the corpus's own light table: **the brightest windowed room in the province, at full
// midday sun, reads `canopy_day` = 0.30** — RI-STL01 §3's own value for daylight arriving through
// a heavy filter, which is what a wall of small shuttered windows is. That fixes
//
//     DAYLIGHT_K = (0.30 - 0.04) / 0.03226 = 8.0595
//
// and every other room follows from its own geometry. Consequences, all of them intended:
// the brightest room reads 0.3000 at noon and 0.0634 at 03:00 overcast; the dimmest windowed room
// reads 0.2012 at noon; a gaol reads 0.0400 at every hour, forever. **An interior is now brighter
// at noon than at midnight**, which is a thing every window in the province was drawn to say and
// no part of the simulation could hear.
//
// KEEPING THE ROUND-3 CRITIC'S 2x2 FINDING TRUE. That critic crossed the two edit sites of the
// round-3 fix and found neither an inert fix nor two-guards-for-one-defect but two independent
// sites — and its arm `01` (lamps kept, old 0.75 ambient restored) read a **flat 1.0000, spread
// 0**: the lamps alone do not make a room discriminate, the ambient drop does. That is why the
// derivation above is bounded at `canopy_day` and not at `overcast_open`: 0.30 is far enough below
// a lamp's near-field (`flame_near` = 0.60) that a lit room still has dark corners, and 0.75 is
// not. The distinction the critic drew is the constraint this derivation is built to respect.

'use strict';

/** The glazed pane `render/interior.js` draws: 0.9 m x 0.8 m. */
export const PANE_W_M = 0.9;
export const PANE_H_M = 0.8;
export const PANE_AREA_M2 = PANE_W_M * PANE_H_M;

/** The doorway the shell cuts, and the minimum height a wall needs before it gets windows. */
export const DOOR_W_M = 1.4;
export const WINDOW_MIN_H_M = 2.4;
export const WINDOW_SILL_Y_M = 1.75;

/** RI-WLD13 N4: a gaol, a barge hold and an undertemple do not have windows. Everything else does. */
export const WINDOWLESS_KINDS = new Set(['prison', 'hold']);

/** `light_table_L`'s `unlit` row — an unlit interior / xanmeer depth. The floor under everything. */
export const UNLIT_L = 0.04;
/** `light_table_L`'s `canopy_day` row — daylight through a heavy filter. The anchor, see the header. */
export const CANOPY_DAY_L = 0.30;
/** The largest aperture ratio in the shipped corpus (`archon-house-0` and its 14 siblings). */
export const MAX_APERTURE_RATIO = 0.03226;
/** (0.30 - 0.04) / 0.03226. Derived from the two rows above and the corpus's own geometry. */
export const DAYLIGHT_K = (CANOPY_DAY_L - UNLIT_L) / MAX_APERTURE_RATIO;

/** A hearth is the room's fire; a lamp is a fitting on a wall. The 2:1 both readers already used. */
export const HEARTH_LIFT_Y_M = 0.5;

const DEFAULT_BOUNDS = { x: [-6, 6], y: [0, 3.2], z: [-9, 9] };

function boundsOf(rec) {
  const b = (rec && rec.bounds_m) || DEFAULT_BOUNDS;
  return { x: b.x, y: b.y, z: b.z, W: b.x[1] - b.x[0], H: b.y[1] - b.y[0], D: b.z[1] - b.z[0] };
}

/**
 * The lamp list, deduped exactly once.
 *
 * `lights[]` is authored PER PROPERTY ZONE, so a three-household interior declares three hearths
 * at the same spot (see `archon-apothecary`, whose ten rows are three households' worth). Both
 * readers rounded each axis to a decimetre and kept the first; that rounding now happens here, so
 * it cannot be changed on one side.
 */
export function dedupedLights(rec) {
  const out = [];
  const seen = new Set();
  for (const L of (rec && rec.lights) || []) {
    const p = L.pos || [0, 1.4, 0];
    const key = `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)},${Math.round(p[2] * 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...L, pos: [p[0], p[1], p[2]], _key: key });
  }
  return out;
}

/**
 * THE LIT SET. Every entry in this list illuminates, in the renderer and in the simulation, and
 * nothing outside it does. Returns, per lamp:
 *
 *   id, kind, hearth, pos [x,y,z], intensity (the AUTHORING weight), snuffable, synthesized,
 *   shadow (true for at most one lamp per room), render_pos (pos, with a hearth's lift applied)
 *
 * `intensity` stays the authoring weight both readers already scale by their own factor — the
 * renderer x9 / x22 into Three.js units, the simulation x`authored_intensity_to_L_scale` into an
 * L. That is a UNITS difference and not a policy one; which lamps are lit at all is the policy,
 * and it is decided here.
 */
export function litLights(rec) {
  const b = boundsOf(rec);
  const unique = dedupedLights(rec);
  const out = [];
  for (const L of unique) {
    const hearth = L.kind === 'hearth';
    const pos = L.pos;
    out.push({
      id: L.id || `${(rec && rec.id) || 'interior'}:${L._key}`,
      kind: L.kind || 'lamp',
      hearth,
      pos,
      render_pos: [pos[0], pos[1] + (hearth ? HEARTH_LIFT_Y_M : 0), pos[2]],
      fitting_pos: [pos[0], hearth ? b.y[0] : Math.max(b.y[0], pos[1] - 0.56), pos[2]],
      intensity: Number(L.intensity === undefined ? 0.55 : L.intensity),
      snuffable: !!L.snuffable,
      synthesized: false,
      shadow: out.length === 0,
    });
  }
  if (out.length) return out;

  // ---- THE FAIL-OPEN, NOW SHARED --------------------------------------------------------------
  // Eleven rooms declare no `lights[]`. The renderer has always built them a hearth so the player
  // is not looking at a black frame; the simulation did not, and pinned them at 0.0400 at every
  // hour. Both now get the SAME hearth, from here. Its weight is 0.9 — the standard authored
  // hearth weight, and the same thing `PointLight(0xffa050, 20, 22)` was already saying (20/22 =
  // 0.909). Its position is the record's own single `light` field where there is one.
  const key = (rec && rec.light) || { pos: [0, 0.7, 0], intensity: 1.0 };
  const kp = key.pos || [0, 0.7, 0];
  const pos = [kp[0], b.y[0] + 0.7, kp[2]];
  return [{
    id: `${(rec && rec.id) || 'interior'}.fallback-hearth`,
    kind: 'hearth',
    hearth: true,
    pos,
    render_pos: [pos[0], pos[1] + HEARTH_LIFT_Y_M, pos[2]],
    fitting_pos: [pos[0], b.y[0], pos[2]],
    intensity: 0.9,
    snuffable: false,
    synthesized: true,
    shadow: true,
  }];
}

/**
 * The windows, as geometry both readers can agree on. RI-WLD13 N4's rule, moved out of the
 * renderer so the SIMULATION can read an aperture: how many follows the wall it is in, a doorway
 * is not glazed, and a room under 2.4 m has none.
 */
export function windowPlan(rec) {
  const b = boundsOf(rec);
  const kind = (rec && rec.interior_kind) || null;
  const entry = (rec && rec.continuity && rec.continuity.entry_side) || 'south';
  const windowless = WINDOWLESS_KINDS.has(kind) || b.H < WINDOW_MIN_H_M;
  const panes = [];
  if (!windowless) {
    const n = Math.max(1, Math.min(4, Math.round(b.W / 3.4)));
    for (const side of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const x = b.x[0] + (i + 0.5) * (b.W / n);
        const z = side < 0 ? b.z[0] + 0.2 : b.z[1] - 0.2;
        const wall = side < 0 ? 'north' : 'south';
        if (wall === entry && Math.abs(x - (b.x[0] + b.x[1]) / 2) < DOOR_W_M) continue;
        panes.push({ x, y: b.y[0] + WINDOW_SILL_Y_M, z, wall });
      }
    }
  }
  const floor_area_m2 = b.W * b.D;
  const glazed_area_m2 = panes.length * PANE_AREA_M2;
  return {
    windowless,
    reason: windowless ? (WINDOWLESS_KINDS.has(kind) ? `interior_kind '${kind}'` : `ceiling ${b.H.toFixed(2)} m < ${WINDOW_MIN_H_M} m`) : null,
    panes,
    count: panes.length,
    floor_area_m2,
    glazed_area_m2,
    aperture_ratio: floor_area_m2 > 0 ? glazed_area_m2 / floor_area_m2 : 0,
  };
}

/**
 * The ambient light on the floor of this room, at this sky. See the header for the derivation.
 *
 * `skyL` is `sim/stealth/system.js#skyAmbient(env)` — the same piecewise table the outdoors reads,
 * so a room's floor and the road outside its door are answering to one clock and one weather.
 */
export function interiorAmbientL(rec, skyL, opts) {
  const o = opts || {};
  const unlit = o.unlit_L === undefined ? UNLIT_L : o.unlit_L;
  const k = o.daylight_k === undefined ? DAYLIGHT_K : o.daylight_k;
  const plan = windowPlan(rec);
  if (plan.windowless) return { L: unlit, windowless: true, aperture_ratio: 0, windows: 0, sky_L: skyL, bleed: 0 };
  const bleed = Math.max(0, skyL) * k * plan.aperture_ratio;
  return {
    L: Math.min(1, unlit + bleed),
    windowless: false,
    aperture_ratio: plan.aperture_ratio,
    windows: plan.count,
    sky_L: skyL,
    bleed,
  };
}

/**
 * The eleven rooms the fail-open above is currently rescuing, by name. A CONTENT debt, not a code
 * one: the right long-term fix is that they declare their own `lights[]` like the other 104, and
 * this list is what a check would shrink. Pass the loaded interiors map.
 */
export function interiorsMissingLights(interiors) {
  const out = [];
  for (const id of Object.keys(interiors || {})) {
    const rec = interiors[id];
    if (!rec || typeof rec !== 'object') continue;
    if (!dedupedLights(rec).length) out.push(id);
  }
  return out.sort();
}
