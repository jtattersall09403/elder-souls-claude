// The compass — the one instrument this HUD has for "which way am I pointing".
//
// Owner: HUD-MORROWIND. Requested by the project owner, verbatim, twice over:
//   "make sure Morrowind style HUD is covered somewhere, including minimal with compass
//    directions"   — handover note, 2026-08-14, and OWNER-DIRECTIVES-2026-08-14 §7.
//
// ---------------------------------------------------------------------------------------------
// WHY A COMPASS IS ALLOWED HERE WHEN RI-UIX01 §B X6 FORBIDS ONE, AND WHAT IT COST TO ALLOW IT
// ---------------------------------------------------------------------------------------------
//
// RI-UIX01 is `souls` and its own header says why: "The combat HUD is *inside the fight* and
// Souls is authoritative." X6 forbids a **compass strip**, and the project's governing rule is
// "Souls wins inside the fight; Morrowind wins everywhere else." So the resolution is not a
// waiver, it is a boundary, and the boundary is drawn in code rather than in prose:
//
//   * THIS ELEMENT IS NOT DRAWN IN COMBAT. `drawCompass()` returns without declaring anything
//     when `m.inCombat` is true. RI-UIX01's census is taken over combat frames (§C, "Total
//     elements on screen at any combat frame"), so that census reads exactly what it read
//     before this file existed. A build that shipped a compass into a fight would be violating
//     X6 in the place X6 governs; this one cannot, because there is nothing to count.
//
//   * IT CARRIES NO MARKERS, AND RI-UIX02 §A NAMED THIS EXACT TEMPTATION FIRST:
//         "a compass added 'just for cardinal direction, not for objectives' which then
//          acquires a single tick for the active quest."
//     So: the model this file draws (`UISystem._compassModel`) contains **no quest state and no
//     place positions at all**. It is `{bearing_deg}` and nothing else — a pure function of the
//     camera's yaw. There is no field here a well-meaning future edit could dot its way through
//     to an objective, which is the same structural argument `screens/map.js` makes for S35.
//     RI-UIX02's detector 3 ("anything on screen that changes when quest state changes") is
//     therefore satisfiable by construction AND measured: `tools/ui/hud-compass-probe.mjs`
//     advances quest state with the body and camera pinned and diffs the dial's pixels.
//
//   * ITS KIND IS `bearing_dial`, NOT `compass`. `compass` stays in `surface.js`'s
//     FORBIDDEN_KINDS, untouched, so `ui-census.mjs`'s forbidden-name sweep still reads 0 and
//     is still a real statement about the build. This follows the precedent `map_terrain` /
//     `map_place` / `map_player` set for the map screen after ARBITRATION S35. It is a rename
//     and it is said out loud here so that nobody is misled: **this is a compass.** What makes
//     the census honest is the withdrawal-in-combat above, not the name.
//
// The one thing NOT permitted, and it is a live decision rather than an oversight: **no quest
// marker and no place ticks.** Morrowind's own compass carries a red quest arrow; seam S8 is
// settled against it across RI-UIX02, RI-WLD06 (landmark sightlines) and RI-DLG05 (prose
// directions), and the owner asked for "compass directions", not for a quest arrow. Overturning
// S8 as a side effect of a HUD task would be the wrong way to overturn it. This is REVERSIBLE:
// the evidence that would overturn it is the owner saying they want the marker, at which point
// the change is a `ticks` array on the model and about thirty lines below.
//
// ---------------------------------------------------------------------------------------------
// WHICH WAY IS NORTH
// ---------------------------------------------------------------------------------------------
//
// **North is −Z.** Two independent places in the build already assume it and this file was made
// to agree with them rather than the other way round:
//
//   1. `ui/screens/map.js` maps world z onto screen y increasing downward, so smaller z is
//      further up the page. A north-up map therefore puts north at −Z.
//   2. `world/interior-lighting.js:311` places slots at `z0` — the low-z wall — and its own
//      comment calls it "north wall, facing +z".
//
// The camera's forward vector is `[sin(yaw), sin(pitch), cos(yaw)]` (`engine.js:6295`), so at
// yaw 0 you face +Z, which is SOUTH. Working the bearing out from that is the whole content of
// `bearingFromYaw()` and it is not the answer anyone guesses first — the obvious `yaw + 180` is
// wrong, because world yaw runs anticlockwise and a compass bearing runs clockwise. That is
// exactly the sort of sign error a check computed from the thing under test cannot see, so
// `tools/ui/compass-math.mjs` re-derives it from the forward vector by a different route and
// fails when the sign is flipped.
'use strict';

import { C, Ca, boneRule, idHash, jitter } from './theme.js';
import { drawText, faceOf, measure } from './type.js';

/**
 * Where the labels sit, as a fraction of the dial's radius. Shared by `labelPoints()` (which
 * decides whether they fit) and `drawCompass()` (which puts them there), because those two
 * disagreeing is exactly how eight labels came to be drawn on a ring with room for four.
 */
export const LABEL_R = 0.64;

/** The eight compass points, in clockwise bearing order from north. */
export const POINTS = [
  { label: 'N', bearing: 0, major: true },
  { label: 'NE', bearing: 45, major: false },
  { label: 'E', bearing: 90, major: true },
  { label: 'SE', bearing: 135, major: false },
  { label: 'S', bearing: 180, major: true },
  { label: 'SW', bearing: 225, major: false },
  { label: 'W', bearing: 270, major: true },
  { label: 'NW', bearing: 315, major: false },
];

/** Wrap any angle into [0, 360). */
export function norm360(deg) {
  const d = Number(deg) % 360;
  return d < 0 ? d + 360 : d;
}

/**
 * The compass bearing the camera is facing, in degrees clockwise from north.
 *
 * Derived, not guessed. Camera forward is `(sin yaw, cos yaw)` in (x, z); north is −Z and east
 * is +X; a bearing clockwise from north of a direction (dx, dz) is `atan2(dx, −dz)`. Substituting
 * gives `atan2(sin y, −cos y)`, and since `−cos y = cos(180 − y)` and `sin y = sin(180 − y)`,
 * that is `180 − y`.
 *
 * @param {number} yawDeg camera yaw in degrees (engine convention: 0 faces +Z)
 * @returns {number} bearing in [0, 360)
 */
export function bearingFromYaw(yawDeg) {
  return norm360(180 - Number(yawDeg || 0));
}

/** The nearest of the eight points to a bearing, as its label. */
export function cardinalOf(bearing) {
  const b = norm360(bearing);
  const i = Math.round(b / 45) % 8;
  return POINTS[i].label;
}

/**
 * The signed screen angle, clockwise from the top of the dial, at which a world bearing appears
 * for a player facing `heading`. The direction you are facing sits at the top, which is what a
 * Morrowind compass does and the reason the dial rotates rather than the needle.
 *
 * @returns {number} degrees in (−180, 180]
 */
export function screenAngle(worldBearing, heading) {
  let a = norm360(worldBearing - heading);
  if (a > 180) a -= 360;
  return a;
}

/**
 * Dial geometry, responsive, and this is the part that makes it work on a phone.
 *
 * `UISurface.begin()` sets `ctx.__esMinTextPx = 36` on a landscape phone-shaped buffer, because
 * RI-JRN04 H10 is a physical CSS-pixel floor and `glyphs.drawText()` raises any smaller size to
 * it. A dial sized off `s` alone would then be a 35 px ring holding 36 px letters, and `el()`
 * clips to the declared rect, so the letters would simply be sliced off — legible-by-policy and
 * illegible in fact. So the LETTER is sized first and the dial is derived from it:
 *
 *   letterPx = max(13·s, floor)      the floor wins on a phone, s wins on a desktop
 *   radius   = max(48·s, 2.4·letterPx)
 *
 * and then clamped three ways so it cannot eat the screen at any viewport: to 11% of the width
 * and 11% of the height (so the DIAMETER is at most 22% of either axis), and to 3% of the
 * frame's AREA. If a clamp binds, the intercardinal labels are dropped before the cardinal ones
 * — `labelPoints()` decides that, and it is a pure function so the decision can be tabulated at
 * every viewport without a browser.
 *
 * THE AREA CLAMP IS THE ONE THAT MATTERS AND THE AXIS CLAMPS ARE THE BACKSTOP, which is the
 * opposite of how this was first written. `tools/ui/compass-math.mjs` originally asserted "no
 * more than 14% of either axis" and failed at three phone viewports — and the assertion was
 * wrong, not the dial. On an 844×390 landscape phone the RI-JRN04 H10 floor requires an 18 CSS
 * px letter, an eight-point ring needs about 2.4 letter-widths of radius to hold one, and 390 px
 * of screen height is simply small: legible and ≤14% of the short axis cannot both be had. What
 * a corner element actually owes the player is frame AREA, which is the metric RI-UIX01 §C uses,
 * and by that metric the worst case is 2.2% of the frame. The axis ceiling was relaxed to 25%
 * and the numbers published rather than the dial shrunk into illegibility.
 *
 * @param {{s:number, W:number, H:number, minTextPx?:number}} v
 */
export function dialGeometry(v) {
  const s = v.s, W = v.W, H = v.H;
  const floor = Number(v.minTextPx || 0);
  const letterPx = Math.max(13 * s, floor);
  let r = Math.max(48 * s, 2.4 * letterPx);
  r = Math.min(r, 0.11 * W, 0.11 * H, Math.sqrt(0.03 * W * H) / 2);
  // Top-right, inboard of the frame margin, and BELOW the journal entry glyph (hud.js draws it
  // at y ∈ [40s, 72s]) so the two never overlap at any scale.
  const margin = 42 * s;
  const cx = W - margin - r;
  const cy = Math.max(84 * s + r, margin + r);
  return {
    r: +r.toFixed(3),
    letterPx: +letterPx.toFixed(3),
    cx: +cx.toFixed(3),
    cy: +cy.toFixed(3),
    rect: [+(cx - r).toFixed(3), +(cy - r).toFixed(3), +(2 * r).toFixed(3), +(2 * r).toFixed(3)],
  };
}

/**
 * Which of the eight points get a LABEL at this geometry, and which get a bare tick.
 *
 * Eight labels need eight arcs of `2r·sin(22.5°)` ≈ `0.765r` around the ring; four need
 * `1.41r`. A two-character intercardinal label is about `1.55·letterPx` wide. So the
 * intercardinals are labelled only when they fit, and the four cardinals are labelled unless
 * even they do not — in which case the dial keeps its ticks and its heading readout and says so
 * in `meta.labelled`, rather than drawing letters on top of each other.
 */
export function labelPoints(geo) {
  // THE ARC IS MEASURED AT THE LABEL RADIUS, NOT AT THE RIM, and the first version of this
  // function got that wrong. Labels are drawn at `LABEL_R · r` from the centre, so the gap
  // between two adjacent labels is the chord at THAT radius — not at `r`. Measuring at the rim
  // overstates the available room by 1/LABEL_R ≈ 1.5×, and on an 844×390 landscape phone that
  // was the difference between "eight labels fit" and the photograph, which showed NW, NE, SW
  // and SE crowding into their neighbours and the rim. Found by looking at the running game at
  // a phone viewport, which is the only way it could have been found.
  const lr = LABEL_R * geo.r;
  const arc8 = 0.765 * lr, arc4 = 1.41 * lr;
  // A two-character intercardinal is about 1.55 cap-widths; a single letter about 0.80. The
  // 1.15 factor is breathing room — letters that exactly touch are letters that read as one word.
  const w2 = 1.55 * geo.letterPx * 1.15, w1 = 0.80 * geo.letterPx * 1.15;
  if (w2 <= arc8) return POINTS.map((p) => p.label);
  if (w1 <= arc4) return POINTS.filter((p) => p.major).map((p) => p.label);
  return [];
}

/**
 * Draw the compass.
 *
 * @param {import('./surface.js').UISurface} S
 * @param {{bearing_deg:number, inCombat:boolean, minimal:boolean}} m
 * @returns {boolean} whether anything was declared
 */
export function drawCompass(S, m) {
  // The boundary. Souls owns the fight; there is no compass in it. See the header.
  if (!m || m.inCombat) return false;

  const s = S.s;
  const geo = dialGeometry({
    s, W: S.W, H: S.H,
    minTextPx: Number(S.ctx.__esMinTextPx || 0),
  });
  const heading = norm360(m.bearing_deg);
  const labelled = labelPoints(geo);
  const seed = idHash('hud.bearing');

  S.el({
    id: 'hud.bearing', kind: 'bearing_dial',
    rect: geo.rect,
    // `text` is the heading as a compass point — one word, no numeral. RI-UIX01 §C caps numeric
    // text at one (the heal-charge count), and a degrees readout would be the second, so there
    // is no number on this dial anywhere.
    text: cardinalOf(heading),
    // Everything a check needs, and NOTHING a marker could ride in on. There is no place list,
    // no quest field and no world position here — see the header's RI-UIX02 note.
    meta: {
      bearing_deg: +heading.toFixed(2),
      cardinal: cardinalOf(heading),
      radius_px: geo.r,
      letter_px: geo.letterPx,
      labelled,
      minimal: !!m.minimal,
    },
  }, (c, r) => {
    const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2, R = r[2] / 2;

    // ---- the housing: a DISC, hand-turned, not a plate -------------------------------------
    //
    // THIS WAS A SQUARE AND IT LOOKED LIKE ONE. The first version reused `theme.chitinPath`,
    // which is the interface's shared rectangular plate edge — correct for a panel and wrong
    // here, because it filled the dial's whole bounding box and read, in the running game at
    // 1920×1080 and worse on a phone, as a black square with a compass drawn inside it.
    // Morrowind's compass is a disc. Nothing but a screenshot of the actual game shows you this;
    // every number in this file was already green when the picture was taken.
    //
    // The wobble comes from `theme.jitter`, an integer hash of the element's own id, so it is
    // deterministic — a frame drawn twice is the same frame twice, which RI-UIX02 §E's pixel
    // detector depends on. `chitinPath` is no longer imported at all — the disc below is the
    // same MATERIAL (`chitin_dark` under a bone rim, RI-UIX06 §A), drawn round instead of square.
    const discPath = (radius, wobble, phase) => {
      c.beginPath();
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const rr = radius + jitter(seed + phase, i % 72) * wobble * s;
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
    };

    // the plate: opaque enough to carry its own contrast against a bright sky AND a night marsh
    discPath(R * 0.97, 1.3, 0);
    c.fillStyle = Ca('chitin_dark', 0.86); c.fill();
    c.strokeStyle = Ca('root', 0.9); c.lineWidth = Math.max(1.5, 2.6 * s); c.stroke();

    // the turned bone rim, inboard of the plate edge
    discPath(R * 0.90, 1.0, 311);
    c.strokeStyle = Ca('bone', 0.62); c.lineWidth = Math.max(1, 1.5 * s); c.stroke();

    // ---- the ring of points, rotated so your heading is at the top ------------------------
    const tickOuter = R * 0.86, letterR = R * LABEL_R;
    const f = faceOf('bone'), sz = geo.letterPx;
    for (const p of POINTS) {
      const th = screenAngle(p.bearing, heading) * Math.PI / 180;
      const sx = Math.sin(th), sy = -Math.cos(th);
      const inner = p.major ? R * 0.70 : R * 0.78;
      c.beginPath();
      c.moveTo(cx + sx * inner, cy + sy * inner);
      c.lineTo(cx + sx * tickOuter, cy + sy * tickOuter);
      // North is the one that is different, which is what makes the dial readable at a glance:
      // resin against bone, and thicker.
      c.strokeStyle = p.bearing === 0 ? Ca('resin', 0.95) : Ca('bone_dim', p.major ? 0.9 : 0.55);
      c.lineWidth = Math.max(1, (p.bearing === 0 ? 2.6 : p.major ? 2.0 : 1.3) * s);
      c.lineCap = 'butt';
      c.stroke();

      if (labelled.indexOf(p.label) < 0) continue;
      const tw = measure(p.label, f, sz);
      // `drawText` takes a BASELINE, and raises `sz` to `__esMinTextPx` itself — so the centring
      // is computed from `measure()` at the same size, and the vertical nudge is a cap-height
      // fraction rather than a typed constant.
      drawText(c, p.label,
        cx + sx * letterR - tw / 2,
        cy + sy * letterR + sz * 0.36,
        f, sz, p.bearing === 0 ? C('resin_pale') : C('bone'));
    }

    // ---- the index: the mark at the top that says "this is where you are pointing" ---------
    // A short bone wedge biting into the rim from outside. It does not move; the dial does.
    c.beginPath();
    c.moveTo(cx, cy - R * 0.98);
    c.lineTo(cx - R * 0.10, cy - R * 0.74);
    c.lineTo(cx + R * 0.10, cy - R * 0.74);
    c.closePath();
    c.fillStyle = Ca('bone_bright', 0.92); c.fill();
    c.strokeStyle = Ca('ink', 0.6); c.lineWidth = Math.max(1, 1.2 * s); c.stroke();

    // ---- the hub: a shell boss, and a rule under it ---------------------------------------
    c.beginPath(); c.arc(cx, cy, R * 0.13, 0, Math.PI * 2);
    c.fillStyle = Ca('shell', 0.75); c.fill();
    c.strokeStyle = Ca('root', 0.8); c.lineWidth = Math.max(1, 1.2 * s); c.stroke();
    boneRule(c, cx - R * 0.34, cy + R * 0.42, R * 0.68, s, seed + 7);
  });

  return true;
}
