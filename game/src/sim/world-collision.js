// The player's body against the static world.
//
// WHY IT IS IN THE CAMERA PIECE. It is not a camera behaviour, but the camera's three
// headline measurables are meaningless without it: `cam-walk-cistern` is a route through
// walls, and a character that walks through walls produces an arm-length histogram of a
// camera flying through rock. RI-CAM01 M2/M3 name those routes; this is the minimum body
// collision that makes running them mean anything. It is deliberately small — a capsule
// pushed out of the same primitive set the spring arm casts against — and it makes no
// attempt to be a movement system. W1-01/W1-09 may replace it wholesale; when they do, the
// camera keeps working, because the camera only ever reads `player.pos`.
//
// It runs AFTER the fight has moved the body and BEFORE the camera reads the pivot, so the
// pivot is the POST-physics controller position exactly as RI-CAM01 §A requires ("pivot
// reads the post-physics controller position, once, after locomotion resolves").
'use strict';

import { EMPTY_CELL } from './collision.js';
import { mirror } from './combat-bridge.js';

/** RI-CAM01 §A's arithmetic depends on this: see game/data/camera/rig.json player_body. */
export const PLAYER_RADIUS_M = 0.55;
const ENEMY_RADIUS_DEFAULT_M = 0.40;

const _p = [0, 0, 0];

export function stepWorldCollision(sim, combat) {
  const cell = sim.cell;
  if (!cell || cell === EMPTY_CELL) return false;
  let moved = false;

  const b = combat && combat.player;
  if (b) {
    _p[0] = b.pos[0]; _p[1] = b.pos[1] + 0.90; _p[2] = b.pos[2];
    if (cell.resolveSphere(_p, PLAYER_RADIUS_M, 6)) {
      b.pos[0] = _p[0]; b.pos[2] = _p[2];
      moved = true;
    }
    // Vertical: stand on whatever solid is under the feet, so the boardwalk deck and the
    // stair treads are walkable rather than decorative.
    const g = groundUnder(cell, b.pos[0], b.pos[2], b.pos[1]);
    if (g !== null && Math.abs(g - b.pos[1]) < 1.0) { if (g !== b.pos[1]) { b.pos[1] = g; moved = true; } }
  }

  if (combat) {
    for (let i = 0; i < sim.entities.length; i++) {
      const e = sim.entities[i];
      const eb = combat.bodyOf(e.eid);
      if (!eb) continue;
      const r = e.radius_m || ENEMY_RADIUS_DEFAULT_M;
      _p[0] = eb.pos[0]; _p[1] = eb.pos[1] + 0.90; _p[2] = eb.pos[2];
      if (cell.resolveSphere(_p, r, 4)) { eb.pos[0] = _p[0]; eb.pos[2] = _p[2]; moved = true; }
      const g = groundUnder(cell, eb.pos[0], eb.pos[2], eb.pos[1]);
      if (g !== null && Math.abs(g - eb.pos[1]) < 1.0) eb.pos[1] = g;
    }
  }

  if (moved && combat) mirror(sim, combat);
  return moved;
}

/**
 * The highest solid surface at or just below the given height, found by a downward probe.
 * Deterministic bisection with a fixed iteration count — no `while`, no tolerance loop that
 * could take a different number of steps on a different machine.
 */
function groundUnder(cell, x, z, y) {
  const top = y + 0.60;
  const bottom = y - 1.20;
  if (!cell.contains(x, bottom, z)) return null;      // nothing solid beneath: leave it alone
  if (cell.contains(x, top, z)) return null;          // buried: the sphere resolve owns this
  let lo = bottom, hi = top;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) * 0.5;
    if (cell.contains(x, mid, z)) lo = mid; else hi = mid;
  }
  return Math.round(hi * 1e6) / 1e6;
}
