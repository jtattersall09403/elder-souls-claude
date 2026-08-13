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

/**
 * RI-CMB04 **M8.5 — ONE BODY, ONE RADIUS** (added wave 1, BAR-CRITIQUE-W1-09-R1 §R6):
 *
 *   "Report the actor's body radius as used for (a) the hit/push volume and (b) world
 *    collision. FAIL if they differ by more than 0.05 m. … the same argument applies to a
 *    player who is 0.30 m wide to a sword and 0.55 m wide to a wall."
 *
 * This file used to declare the second copy. `PLAYER_RADIUS_M = 0.55` and
 * `ENEMY_RADIUS_DEFAULT_M = 0.40` were a *third* and *fourth* statement of a number
 * `hitgeometry.json §bodies` and `skeleton.json §standing_collider` had already made — and the
 * enemy branch did not even read the default, it read `entity.radius_m`, which is RI-AI01's AI
 * **spacing** radius (0.5 m for the champion): how far the archetype likes to stand off, not
 * how wide its body is. A champion was therefore 0.32 m wide to a sword, 0.50 m wide to a wall
 * and 0.64 m wide to another body.
 *
 * There is now ONE source and it is the `CombatBody`'s own `bodyRadius`, which
 * `CombatSystem.createPlayer/spawnEnemy` reads from `hitgeometry.json §bodies` (0.32 m, itself
 * `skeleton.json`'s declared movement capsule). A copy that does not exist cannot drift.
 *
 * **CROSS-PIECE DEBT, raised and not buried.** `game/data/camera/rig.json §player_body` derives
 * RI-CAM05 §F's 0.35 m camera-to-head invariant from a 0.55 m world-collision radius: *"A
 * smaller body radius puts the camera inside the character's head in that pose."* That
 * derivation now rests on 0.32 m and **the camera piece must re-run its penetration guard.**
 * Nothing in the running code reads `rig.json §player_body` — it is documentation of an
 * arithmetic argument — so this change cannot silently move the camera; it can only invalidate
 * the argument, which is why it is stated here in the file that broke it.
 *
 * `PLAYER_RADIUS_M` survives as a named export because `engine.js` reports it on the harness
 * surface, and S50 now raises only player world clearance to 0.35 m, within the 0.05 m tolerance of the 0.32 m fight radius.
 */
// S50 requires enough backing-wall clearance for the unchanged camera/head geometry
// (0.349857... m horizontally).  0.35 m is still within RI-CMB04 M8.5's 0.05 m tolerance of
// the combat body's authoritative 0.32 m hit radius.
export const PLAYER_RADIUS_M = 0.35;
const ENEMY_RADIUS_DEFAULT_M = 0.32;

/**
 * The radius this body presents to the world, for M8.5's report and for the resolve below.
 * The CombatBody's own `bodyRadius` when it has one; the shared default otherwise. Never
 * `entity.radius_m` — that is AI spacing.
 */
export function worldCollisionRadiusOf(body) {
  return (body && body.bodyRadius) || ENEMY_RADIUS_DEFAULT_M;
}

const _p = [0, 0, 0];

export function stepWorldCollision(sim, combat) {
  const cell = sim.cell;
  if (!cell || cell === EMPTY_CELL) return false;
  let moved = false;

  const b = combat && combat.player;
  if (b) {
    _p[0] = b.pos[0]; _p[1] = b.pos[1] + 0.90; _p[2] = b.pos[2];
    if (cell.resolveSphere(_p, Math.max(worldCollisionRadiusOf(b), PLAYER_RADIUS_M), 6)) {
      b.pos[0] = _p[0]; b.pos[2] = _p[2];
      moved = true;
    }
    // Vertical: stand on whatever solid is under the feet, so the boardwalk deck and the
    // stair treads are walkable rather than decorative.
    const g = groundUnder(cell, b.pos[0], b.pos[2], b.pos[1]);
    // The committed jump clip owns world Y during its declared airborne window. The old ground
    // snap ran after combat and flattened every 0.62 m jump because it accepts a surface within
    // 1 m. Horizontal wall resolution still runs above, and landing frames resume this support
    // probe normally.
    if (!b.airborne && g !== null && Math.abs(g - b.pos[1]) < 1.0) {
      if (g !== b.pos[1]) { b.pos[1] = g; moved = true; }
    }
  }

  if (combat) {
    for (let i = 0; i < sim.entities.length; i++) {
      const e = sim.entities[i];
      const eb = combat.bodyOf(e.eid);
      if (!eb) continue;
      // NOT `e.radius_m` — see the M8.5 note at the top of this file. That field is RI-AI01's
      // AI spacing radius and using it here made the champion 0.50 m wide to a wall and 0.32 m
      // wide to a sword.
      const r = worldCollisionRadiusOf(eb);
      _p[0] = eb.pos[0]; _p[1] = eb.pos[1] + 0.90; _p[2] = eb.pos[2];
      if (cell.resolveSphere(_p, r, 4)) { eb.pos[0] = _p[0]; eb.pos[2] = _p[2]; moved = true; }
      const g = groundUnder(cell, eb.pos[0], eb.pos[2], eb.pos[1]);
      if (g !== null && Math.abs(g - eb.pos[1]) < 1.0) eb.pos[1] = g;
    }
  }

  if (moved && combat) mirror(sim, combat);
  return moved;
}

/** Resolve scheduled, non-combat people against the same room/street cell as the player.
 * NPC schedules move their visible `pos` directly and therefore do not have CombatBody entries;
 * without this pass they were the one character family still able to walk through a generated
 * room shell. Only people present in the player's current cell participate. */
export function stepNPCWorldCollision(sim) {
  const cell = sim && sim.cell;
  if (!cell || cell === EMPTY_CELL || !sim.npcs || !sim.npcs.length) return false;
  let moved = false;
  for (let i = 0; i < sim.npcs.length; i++) {
    const n = sim.npcs[i];
    if (!n.present) continue;
    _p[0] = n.pos[0]; _p[1] = n.pos[1] + 0.90; _p[2] = n.pos[2];
    if (cell.resolveSphere(_p, ENEMY_RADIUS_DEFAULT_M, 4)) {
      n.pos[0] = _p[0]; n.pos[2] = _p[2]; moved = true;
    }
    const g = groundUnder(cell, n.pos[0], n.pos[2], n.pos[1]);
    if (g !== null && Math.abs(g - n.pos[1]) < 1.0) n.pos[1] = g;
  }
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
