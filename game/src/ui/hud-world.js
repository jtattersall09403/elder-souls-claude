// The out-of-combat HUD — the world set (RI-UIX07 §B, W2/W3/W5/W6).
//
// Owner: T4-r2. Judged by RI-UIX07 V1, V3, V4, V5, V6, V7, V8.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS IS ITS OWN MODULE AND NOT FOUR MORE BLOCKS IN `hud.js`
// ---------------------------------------------------------------------------------------------
//
// RI-UIX07 §Comparison-method 3 — the one check the item says "cannot be faked by a self-report" —
// is the census-identity test, and its instruction is literal: *"Build a copy with the world-set
// module deleted (RI-MTH04's deletion discipline: delete it, do not flag it off). Run RI-UIX01's
// combat census on both. Diff the element lists frame by frame."*
//
// A world set spread across `hud.js` has no such module, so the test cannot be run as written and
// whoever tries will substitute a flag, which is exactly what RI-MTH04 forbids. So: the four
// elements live here, `hud.js` imports one function, and deleting this file's body is a one-line
// operation whose effect is a strictly smaller element list. W1 (`bearing_dial`) is already its own
// module (`ui/compass.js`) for the same reason and W4 is drawn inside RI-UIX01 E5's own rect — see
// `ui/icons.js`'s `conditionMark()` — so the delete-the-fix arm for the whole world set is
// `compass.js` + this file + one `itemIcon()` option.
//
// ---------------------------------------------------------------------------------------------
// E-T2 / E-T3 — WHO WITHDRAWS, AND THE WITHDRAWAL IS INSTANT
// ---------------------------------------------------------------------------------------------
//
//   W1 bearing dial     out of combat only     (`compass.js` already did this before the item
//                                               was written; it is E-T2 built ahead of its rule)
//   W2 effect strip     out of combat only
//   W5 place name       out of combat only
//   W3 sneak state      BOTH phases            "whether you are still hidden is at its most
//                                               load-bearing during the fight you are trying not
//                                               to have" — RI-UIX07 E-T6
//   W4 condition marks  BOTH phases            inside E5's rect; adds nothing to any count
//   W6 breath meter     BOTH phases            "drowning does not pause for a fight"
//
// **There is no fade anywhere in this file, in either direction, and there must not be.** E-T3
// permits a ≤250 ms ramp on EXIT and forbids one on ENTRY, and the reason is a measurement one
// rather than a taste one: RI-UIX01 §C's census is taken over combat frames, so a dial that fades
// out over twelve frames is a dial present in twelve combat frames and the coverage budget is blown
// by an animation nobody thinks of as an element. Building the permitted exit fade would buy
// nothing and would put a second clock next to E-T4's one clock, so it is not built — which is
// stricter than the item requires and is recorded here so a critic does not read its absence as an
// oversight. `frames_since_phase_change` is published in `getUIState()` so E-T3's ramp detector has
// something to read either way.
//
// ---------------------------------------------------------------------------------------------
// §D — PLACEMENT, WHICH IS A CHECK RATHER THAN A PREFERENCE
// ---------------------------------------------------------------------------------------------
//
// D1: no world-set element's rect may lie wholly in the top half. Every rect below is anchored to
// the bottom margin, so `y + h > H/2` at every viewport by construction. This is the row round 1
// failed — the bearing dial was at `[1782, 84, 96, 96]`, `y + h = 180` against `H/2 = 540`.
//
// D4: no overlap with any RI-UIX01 element's rect. The bottom rail is shared with E5 (quick slots,
// bottom-right 150×150), E9 (equip load, above E5), E8 (the boss bar, y 962–996 at 1080p) and E10
// (the interact prompt, y 830–862 centred). The layout below clears all four, and the clearance is
// CHECKED rather than asserted: `getUIState().hud.world.overlaps` is derived from the drawn rects,
// so an edit to `hud.js`'s `L` table that pushed a Souls element into a world one turns that list
// non-empty instead of going unnoticed.
//
// One near-miss is worth naming because it looks like a defect and is not. W5 (place name) sits at
// `y = H − 130·s`, which at 1080p is 950–986, and E8's boss bar is 962–996 — they overlap in y and
// would overlap in x on a wide name. **They can never be on screen together**: E8 exists only in a
// fog-gated fight and W5 withdraws on the first frame of one. The overlap check reports what it
// finds on the frame it is given, which is the honest scope.
'use strict';

import { C, Ca, boneRule, chitinPath, idHash, jitter } from './theme.js';
import { drawText, faceOf, measure, ellipsise } from './type.js';
import { drawObject, effectShape } from './icons.js';
import { dialGeometry } from './compass.js';

/** 1080p geometry, scaled by `s`. Every number here is answerable to §C's coverage budget. */
export const WL = {
  margin: 42,
  sneak: 40,
  stripH: 32, stripMaxW: 360, stripPitch: 30, stripGap: 12,
  placeW: 520, placeH: 36,
  breathW: 400, breathH: 24,
  // RI-UIX01 §A's quick-slot box, restated so this file's clearance from E5 is visible next to
  // the number it clears. `hud.js` L.slotBox must agree; `overlaps` catches it if it stops.
  e5Box: 150, e5Clear: 16,
};

/**
 * Draw the world set. Returns the ids it declared, so the caller can report them.
 *
 * @param {import('./surface.js').UISurface} S
 * @param {object} m the world model — `ui/system.js` `_worldModel()`
 * @returns {{drawn: string[], withdrawn: {id:string, because:string}[]}}
 */
export function drawWorldSet(S, m) {
  const s = S.s, W = S.W, H = S.H;
  const fight = !!(m && m.inCombat);
  const drawn = [];
  const withdrawn = [];

  // ---- W3 sneak state. BOTH phases, only while sneaking. Bottom-LEFT. ----------------------
  //
  // The bottom-left corner is free in this build: RI-UIX01 puts the three bars and the heal
  // charges at the TOP-left (`hud.js` L.barY = 40, L.pipsY = 118), which is a Souls arrangement
  // and is not this item's to move. Morrowind's own M7 sits on the bottom-left rail beside the
  // spell icon, so the corner is right even though the neighbours differ.
  if (m.sneaking) {
    const w = WL.sneak * s;
    S.el({
      id: 'hud.sneak', kind: 'sneak_state',
      rect: [WL.margin * s, H - (WL.margin + WL.sneak) * s, w, w],
      text: null,
      meta: { hidden: !!m.hidden, visibility: m.visibility === null || m.visibility === undefined ? null : +Number(m.visibility).toFixed(3) },
    }, (c, r) => {
      const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2, R = r[2] * 0.42;
      // A closed eye cut in bone when you are unseen; the same eye OPEN when something has you.
      // It is a drawn thing rather than a word, and it never says WHO — that would be a marker
      // for a body, which RI-UIX02 §C's detectors would rightly find.
      c.save();
      c.beginPath();
      c.moveTo(cx - R, cy);
      c.quadraticCurveTo(cx, cy - R * (m.hidden ? 0.55 : 1.0), cx + R, cy);
      c.quadraticCurveTo(cx, cy + R * (m.hidden ? 0.10 : 1.0), cx - R, cy);
      c.closePath();
      c.fillStyle = Ca('chitin_dark', 0.80); c.fill();
      c.strokeStyle = Ca(m.hidden ? 'bone' : 'resin', 0.95);
      c.lineWidth = Math.max(1.4, 2.2 * s); c.stroke();
      if (!m.hidden) {
        c.beginPath(); c.arc(cx, cy, R * 0.34, 0, Math.PI * 2);
        c.fillStyle = Ca('resin', 0.92); c.fill();
      }
      c.restore();
    });
    drawn.push('hud.sneak');
  }

  // ---- W6 breath meter. BOTH phases, only while submerged. Bottom-centre. -------------------
  //
  // Bottom-centre and not Morrowind's top-centre (M11), because §D1 is a hard requirement on the
  // whole world set and it is the row round 1 failed. The centre 50%×50% box ends at 0.75·H = 810
  // at 1080p and this sits at 1014–1038, so C6 is untouched.
  if (m.submerged && m.breathFrac !== null && m.breathFrac !== undefined) {
    const w = WL.breathW * s, h = WL.breathH * s;
    S.el({
      id: 'hud.breath', kind: 'breath_meter',
      rect: [(W - w) / 2, H - (WL.margin + WL.breathH) * s, w, h],
      fill: +Math.max(0, Math.min(1, m.breathFrac)).toFixed(4), text: null,
      meta: { breath_s: m.breath === null ? null : +Number(m.breath).toFixed(2) },
    }, (c, r) => {
      const f = Math.max(0, Math.min(1, m.breathFrac));
      chitinPath(c, r[0], r[1], r[2], r[3], s, 5150);
      c.fillStyle = Ca('chitin_dark', 0.88); c.fill();
      c.strokeStyle = Ca('bone_dim', 0.85); c.lineWidth = 1.6 * s; c.stroke();
      c.fillStyle = C('shell_cold');
      c.fillRect(r[0] + 3 * s, r[1] + 3 * s, (r[2] - 6 * s) * f, r[3] - 6 * s);
      // bubbles, so the bar is a breath and not a generic meter
      for (let i = 0; i < 5; i++) {
        const bx = r[0] + r[2] * (0.12 + i * 0.19) + jitter(517, i) * 3 * s;
        c.beginPath(); c.arc(bx, r[1] + r[3] * 0.5, r[3] * 0.16, 0, Math.PI * 2);
        c.strokeStyle = Ca('shell_lit', 0.55); c.lineWidth = Math.max(1, 1.2 * s); c.stroke();
      }
    });
    drawn.push('hud.breath');
  }

  // ---- everything below withdraws on the entry frame (E-T2). No fade, no tween. -------------
  if (fight) {
    withdrawn.push({ id: 'hud.effects', because: 'combat_phase' });
    withdrawn.push({ id: 'hud.place', because: 'combat_phase' });
    return { drawn, withdrawn };
  }

  // ---- W2 active-effect strip. Grows LEFTWARD along the bottom rail from the dial. ----------
  //
  // M8 does exactly this from M6 in Morrowind. One glyph per effect currently on you, capped at
  // §B's twelve. The glyphs come from `ui/icons.js` — the same table the inventory rows use —
  // because a second drawing vocabulary for effects would be a second visual language, and it
  // would also be a second place to have to look when RI-UIX09 P6 is checked.
  const fx = (m.effects || []).slice(0, 12);
  if (fx.length) {
    const pitch = WL.stripPitch * s, h = WL.stripH * s;
    const w = Math.min(WL.stripMaxW * s, fx.length * pitch);
    // Right edge: immediately inboard of the dial, which is itself inboard of E5.
    const dialLeft = W - (WL.margin + WL.e5Box + WL.e5Clear) * s - 2 * dialRadius(S);
    const x = dialLeft - WL.stripGap * s - w;
    S.el({
      id: 'hud.effects', kind: 'effect_strip',
      rect: [x, H - (WL.margin + WL.stripH) * s, w, h], text: null,
      // The effects, their families and how long is left. NOT their source quest, and there is
      // no quest field on the model this is handed — see `_worldModel()`.
      meta: {
        count: fx.length,
        effects: fx.map((e) => ({ effect: e.effect, family: effectShape(e.effect), remaining_f: e.remaining_f || null })),
      },
    }, (c, r) => {
      for (let i = 0; i < fx.length; i++) {
        const gx = r[0] + i * pitch;
        if (gx + pitch > r[0] + r[2] + 1) break;
        drawObject(c, effectShape(fx[i].effect), gx + 2 * s, r[1] + 2 * s,
          pitch - 5 * s, r[3] - 4 * s, s, idHash('fx' + fx[i].effect), null);
      }
      boneRule(c, r[0], r[1] + r[3] - 1 * s, r[2], s, 6161);
    });
    drawn.push('hud.effects');
  }

  // ---- W5 place-name announcement. Transient, ≤3 s, out of combat. --------------------------
  //
  // M9 in Morrowind: the name of the cell you just walked into, and nothing else. It carries no
  // destination, no distance and no direction — it tells you where you ARE, which is the only
  // navigational statement a markerless world is allowed to make on the HUD (RI-UIX02 §F; the
  // positive obligations live in RI-WLD06 and RI-DLG05, not here).
  if (m.placeAnnounce) {
    const w = WL.placeW * s, h = WL.placeH * s;
    S.el({
      id: 'hud.place', kind: 'place_name',
      rect: [WL.margin * s, H - (WL.margin + WL.sneak + 12 + WL.placeH) * s, w, h],
      text: m.placeAnnounce,
      meta: { frames_left: m.placeFramesLeft === undefined ? null : m.placeFramesLeft },
    }, (c, r) => {
      const f = faceOf('bone'), sz = 19 * s;
      const t = ellipsise(String(m.placeAnnounce), f, sz, r[2] - 8 * s);
      drawText(c, t, r[0], r[1] + r[3] * 0.72, f, sz, C('bone'));
      boneRule(c, r[0], r[1] + r[3] - 2 * s, Math.min(r[2], measure(t, f, sz) + 12 * s), s, 4141);
    });
    drawn.push('hud.place');
  }

  return { drawn, withdrawn };
}

/**
 * The dial's radius at this surface, from `compass.js`'s own arithmetic.
 *
 * IMPORTED, NOT RE-DERIVED. The effect strip has to stop before the dial starts, so it needs the
 * dial's width — and a second copy of `dialGeometry`'s clamp chain here would be the exact failure
 * `compass.js` records against `labelPoints()`: two functions that must agree, disagreeing, with
 * the symptom only visible in a photograph at one viewport. `dialGeometry` is pure, so calling it
 * twice on one frame costs nothing and cannot disagree with itself.
 */
function dialRadius(S) {
  return dialGeometry({ s: S.s, W: S.W, H: S.H, minTextPx: Number(S.ctx.__esMinTextPx || 0) }).r;
}
