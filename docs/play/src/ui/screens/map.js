// The map: where you have been, and what you found there.
//
// Owner: W1-MAP. Binding: `ARBITRATION.md` seam S35 and
// `corpus/00-doctrine/AMENDMENT-W1-MAP-01.md`.
//
// ---------------------------------------------------------------------------------------------
// WHAT THIS SCREEN REFUSES, WHICH IS THE PART S35 CARES ABOUT
//
// S35: *"The map is a record of where you have been and what you have found. It is never an
// instruction about where to go."* So, structurally rather than by discipline:
//
//   * The model this file draws is `Discovery`, whose only mutator has arity 0. There is no
//     argument anywhere in this build in which a quest could name a place to reveal.
//   * `game/data/world/roads.json` IS NOT IMPORTED HERE and must never be. S35 forbids "a
//     route, path, trail or line of any kind", and a drawn road is the first thing a hostile
//     critic will correctly call a line. Wayfinding is the signposts' job.
//   * `sim.quest` IS NOT REACHED FROM HERE. The model this screen is handed
//     (`UISystem._mapModel`) contains no quest state at all, so a well-meaning future edit
//     cannot dot its way to an objective — there is nothing to dot through.
//   * No numeral is drawn on either view. No distance, no bearing, no coordinate, no scale
//     figure. S35 forbids "distance or direction readouts to anything" and the safest reading
//     of "to anything" is "at all".
//   * Selecting a place NAMES it. It does not travel to it, centre on it, or draw anything
//     between it and you.
//
// UNDISCOVERED IS UNRENDERED. `undiscovered_hex` in `game/data/ui/map.json` is the screen's own
// ground, not a dimmed province — there is nothing underneath it to dim. A build that draws the
// whole province at 15% and calls the rest fog has drawn the whole province, and the amendment's
// appendix tells a critic to check exactly that first.
// ---------------------------------------------------------------------------------------------
//
// EVERYTHING IS DRAWN FROM `game/data/world/`. The terrain colours come from the region raster
// and `regions.json palette_hex`; the shading comes from the same `base_dm` channel the
// collision surface uses; the place positions come from `terrain.json sites` and `pois.json`.
// There is no authored map image in this build, so the map cannot drift from the province:
// recolour a region or move a site and the map changes with it. `map-probe.mjs` C2/C3 perturbs
// exactly those two files and reads the difference off the drawn pixels.
'use strict';

import { Ca, boneRule } from '../theme.js';
import { screen, hint, ink, inkDim, CALM_ALPHA, COMBAT_ALPHA } from '../chrome.js';
import { drawText, faceOf, measure } from '../type.js';

/**
 * @param {UISurface} S
 * @param {object} m  from UISystem._mapModel — see that method for the field list. It contains
 *   no quest state, by construction.
 */
export function drawMap(S, m) {
  const s = S.s;
  const alpha = m.inCombat ? COMBAT_ALPHA : CALM_ALPHA;
  const local = m.view === 'local';
  const sc = screen(S, 'map', local ? 'Where I am' : 'Where I have been', m.regionName || null, 'parchment', alpha);
  const [ix, iy, iw, ih] = sc.inner;

  // The drawing box, square-ish and centred, so the province is not stretched. The aspect is
  // the PROVINCE's, taken from the terrain raster, not a number typed here.
  const aspect = local ? 1 : (m.world.w / m.world.h);
  let bw = iw, bh = iw / aspect;
  if (bh > ih - 40 * s) { bh = ih - 40 * s; bw = bh * aspect; }
  const bx = ix + (iw - bw) / 2, by = iy + 6 * s;

  const spanX = local ? m.localSpan : m.world.w;
  const spanZ = local ? m.localSpan : m.world.h;
  const originX = local ? m.player.x - spanX / 2 : 0;
  const originZ = local ? m.player.z - spanZ / 2 : 0;
  const toScreen = (wx, wz) => [bx + ((wx - originX) / spanX) * bw, by + ((wz - originZ) / spanZ) * bh];

  // ---- the ground you have crossed ---------------------------------------------------------
  //
  // One element for the whole raster rather than one per cell: 42,846 elements would make
  // `getUIState()` unreadable and `unionArea()` quadratic, and the census question a critic
  // actually asks of this element is "how much of the province is rendered", which is a single
  // number best reported once. `meta.revealed_cells` and `meta.drawn_cells` are that number, and
  // `drawn_cells` counts what this layout PAINTED rather than what the model knows — so an
  // ablation that stops the model recording is visible here as well as in the framebuffer.
  let drawn = 0;
  S.el({
    id: 'map.terrain', kind: 'map_terrain',
    rect: [bx, by, bw, bh], opacity: alpha,
    meta: {
      view: m.view,
      revealed_cells: m.revealedCells,
      total_cells: m.totalCells,
      revealed_frac: +(m.revealedCells / m.totalCells).toFixed(5),
      source: 'game/data/world/terrain.json + regions.json',
      roads_drawn: 0,          // S35: no route, path, trail or line. Asserted, not assumed.
      routes_drawn: 0,
    },
  }, (c, r) => {
    // The unrendered ground. This is the screen's own colour, painted first and left showing
    // wherever nothing was discovered — not a dimmed province.
    c.fillStyle = m.undiscoveredHex;
    c.fillRect(r[0], r[1], r[2], r[3]);

    const c0 = Math.max(0, Math.floor(originX / m.cell));
    const c1 = Math.min(m.cols - 1, Math.ceil((originX + spanX) / m.cell));
    const r0 = Math.max(0, Math.floor(originZ / m.cell));
    const r1 = Math.min(m.rows - 1, Math.ceil((originZ + spanZ) / m.cell));
    const pw = (m.cell / spanX) * r[2], ph = (m.cell / spanZ) * r[3];
    for (let rz = r0; rz <= r1; rz++) {
      for (let cx = c0; cx <= c1; cx++) {
        if (!m.seen(cx, rz)) continue;
        drawn++;
        const px = r[0] + ((cx * m.cell - originX) / spanX) * r[2];
        const pz = r[1] + ((rz * m.cell - originZ) / spanZ) * r[3];
        c.fillStyle = m.cellHex(cx, rz);
        // +1 on the size so neighbouring cells meet: at province scale a cell is under 8 px
        // and a sub-pixel gap reads as a grid, which looks like a UI and not like ground.
        c.fillRect(px, pz, Math.max(1, pw + 1), Math.max(1, ph + 1));
      }
    }
  });
  // The layout writes back what it painted, so the element's own record is honest about the
  // frame the player is looking at rather than about the model's totals.
  S.elements[S.elements.length - 1].meta.drawn_cells = drawn;

  // ---- the places you have stood in ---------------------------------------------------------
  //
  // One small square each, exactly as S35 permits. `m.places` is the discovery model's own list
  // and there is no other source: a place cannot appear here without the body having been
  // inside its built pad.
  m.places.forEach((p, i) => {
    const [px, pz] = toScreen(p.x, p.z);
    const q = m.placePx;
    if (px < bx - q || px > bx + bw + q || pz < by - q || pz > by + bh + q) return;
    const on = i === m.placeIdx;
    S.el({
      id: 'map.place.' + p.id, kind: 'map_place',
      rect: [px - q / 2, pz - q / 2, q, q],
      // The name is on the element for the same reason every other screen puts its text there:
      // so the census and the pixels cannot disagree. It is NOT drawn unless pointed at.
      text: p.name, focused: on, opacity: alpha,
      meta: { place: p.id, discovered: true, quest: null, objective: null, travel: false },
    }, (c, r) => {
      c.fillStyle = m.placeHex;
      c.fillRect(r[0], r[1], r[2], r[3]);
      c.strokeStyle = Ca('ink', 0.85); c.lineWidth = 1.2 * s;
      c.strokeRect(r[0] + 0.5, r[1] + 0.5, r[2] - 1, r[3] - 1);
    });
  });

  // The name of the place being pointed at — Morrowind's own affordance, moved from a mouse
  // to the stick because rule 2 of `ui/system.js` is that there is no pointer path in this
  // interface. It is a label on the map, not a line to the place, and it says nothing but the
  // name: no distance, no direction, no state, no quest.
  const sel = m.places[m.placeIdx] || null;
  if (sel) {
    const [px, pz] = toScreen(sel.x, sel.z);
    const f = faceOf('bone'), sz = 15 * s;
    const w = measure(sel.name, f, sz) + 16 * s;
    const lx = Math.min(bx + bw - w, Math.max(bx, px - w / 2));
    const ly = pz - 26 * s < by ? pz + 12 * s : pz - 26 * s;
    S.el({
      id: 'map.naming', kind: 'map_place',
      rect: [lx, ly, w, 22 * s], text: sel.name, focused: true, opacity: alpha,
      meta: { place: sel.id, names: sel.id, quest: null, objective: null, travel: false },
    }, (c, r) => {
      c.fillStyle = Ca('parchment', 0.88);
      c.fillRect(r[0], r[1], r[2], r[3]);
      drawText(c, sel.name, r[0] + 8 * s, r[1] + 16 * s, f, sz, ink());
    });
  }

  // ---- you ----------------------------------------------------------------------------------
  //
  // Position and facing, both explicitly permitted by S35. A chevron rather than a dot, because
  // the facing is the half that makes the map usable without becoming an instruction: it tells
  // you which way you are turned, and nothing about which way to go.
  const [ux, uz] = toScreen(m.player.x, m.player.z);
  const cp = m.chevronPx * s;
  S.el({
    id: 'map.player', kind: 'map_player',
    rect: [ux - cp, uz - cp, cp * 2, cp * 2], opacity: alpha,
    meta: { facing: true, position: true, destination: null, route: null },
  }, (c, r) => {
    const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
    // Yaw is the body's, in degrees, with 0 = +Z and increasing toward +X — the convention
    // `sim/player.js` uses and the one `Engine._uiCtx`'s camera pose is built from
    // (`sin(yaw)` on x, `cos(yaw)` on z).
    //
    // On this map +Z is DOWN the screen, because `toScreen` maps world z onto screen y without
    // flipping it. So a body-local offset (right, forward) becomes the screen offset
    // (right·cos + forward·sin, −right·sin + forward·cos) with no negation on the y term. The
    // first version of this had a `* -1` there and drew the chevron pointing exactly backwards
    // — which looks entirely plausible until you turn around.
    const a = (m.player.yaw * Math.PI) / 180;
    const sn = Math.sin(a), cs = Math.cos(a);
    const pt = (right, fwd) => [cx + right * cs + fwd * sn, cy - right * sn + fwd * cs];
    const [ax, ay] = pt(0, cp);
    const [b1x, b1y] = pt(-cp * 0.62, -cp * 0.55);
    const [b2x, b2y] = pt(cp * 0.62, -cp * 0.55);
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(b1x, b1y); c.lineTo(cx, cy); c.lineTo(b2x, b2y);
    c.closePath();
    c.fillStyle = m.playerHex; c.fill();
    c.strokeStyle = Ca('ink', 0.9); c.lineWidth = 1.2 * s; c.stroke();
  });

  // ---- the foot -----------------------------------------------------------------------------
  S.el({ id: 'map.rule', kind: 'divider', rect: [ix, by + bh + 6 * s, iw, 6 * s], opacity: alpha },
    (c, r) => boneRule(c, r[0], r[1] + 3 * s, r[2], s, sc.seed + 9));
  hint(S, 'map.hint', ix, by + bh + 14 * s, iw,
    local
      ? 'stick: the places you have found   ·   confirm: the province   ·   back: close'
      : 'stick: the places you have found   ·   confirm: where I am   ·   back: close',
    alpha);
  // What the player has found, in words rather than in a count, because a count is a completion
  // meter and this map has no completion. It reads "nowhere yet" on a new character, which is
  // the honest thing for a screen whose subject is absence.
  const foundText = m.places.length === 0
    ? 'I have not written anything down yet.'
    : (m.places.length === 1 ? 'One place I have stood in.' : 'Places I have stood in.');
  S.el({
    id: 'map.found', kind: 'hint',
    rect: [ix, by + bh + 40 * s, iw, 22 * s], text: foundText, opacity: alpha,
  }, (c, r) => {
    drawText(c, foundText, r[0], r[1] + 15 * s, faceOf('ink'), 13 * s, inkDim());
  });
}

/** Shading for one cell, from the region palette and the height channel. Exported for the probe. */
export function shadeHex(baseHex, t, lo, hi) {
  const k = lo + (hi - lo) * Math.max(0, Math.min(1, t));
  const n = parseInt(baseHex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * k)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * k)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * k)));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
