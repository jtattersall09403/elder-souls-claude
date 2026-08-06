// The scripted navmesh-spine traversal — the driver RI-CAM01 M2 and RI-CAM05 M4/M5 name and
// which nothing in the build previously provided.
//
// WHY IT IS A SIM MODULE AND NOT A TOOL. Both methods say "run the scripted navmesh-spine
// traversal at run speed". A tool that teleported the player once per frame would work for the
// arm histogram and be *wrong* for everything else: `teleport()` snaps the vertical pivot
// spring (RI-CAM01 §B "Reset"), so a per-frame teleport would reset the one piece of state
// RI-CAM05 §D's stair bars exist to measure, and the tread-frequency FFT would come back flat
// for the wrong reason. The route therefore advances the controller *inside* the fixed step,
// in the same slot world collision writes to — after the fight, after physics, before the
// camera — which is exactly where RI-CAM01 §A says the pivot reads its input from.
//
// GROUND. The route's Y comes from the camera cell's own collision set, by downward search,
// not from the province field. That is deliberate: the cells are authored fixtures (a spiral
// stair, a boardwalk on stilts, a mangrove root mat) that do not exist in the province
// heightfield, and a stair whose treads the *camera* can see but the *player* walks through
// would make every stair bar meaningless.
//
// DETERMINISM. Pure float arithmetic over the committed JSON. No RNG, no clock, no allocation
// per frame (RI-PLT01 P4): the scan below writes into module scratch and returns a number.
'use strict';

/** Surface height at (x,z) inside a collision cell, by coarse descent + bisection.
 *
 *  `contains()` is the same predicate `clip_through` is defined against (RI-CAM01 §D), so the
 *  ground the player stands on and the geometry the camera is tested against are by
 *  construction the same set — there is no second collision representation to drift. */
export function groundYInCell(cell, x, z, topY, floorY) {
  const top = topY === undefined ? 12 : topY;
  const floor = floorY === undefined ? -4 : floorY;
  const STEP = 0.02;
  let hi = top;
  if (cell.contains(x, hi, z)) return hi;              // buried: nothing above to stand on
  for (let y = top; y > floor; y -= STEP) {
    if (cell.contains(x, y, z)) {
      // Bisect between the last clear sample and this solid one, 8 halvings ⇒ ≤ 8e-5 m.
      let lo = y, up = y + STEP;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + up) * 0.5;
        if (cell.contains(x, mid, z)) lo = mid; else up = mid;
      }
      return up;
    }
    hi = y;
  }
  return floor;
}

/**
 * Begin a scripted route. `pts` is the cell's spine, a polyline of [x,z].
 * @param {object} sim
 * @param {object} o {cell, pts, speedMps, loop, laps}
 */
export function beginRoute(sim, o) {
  const pts = o.pts.map((p) => [Number(p[0]), Number(p[1])]);
  let total = 0;
  const seg = [];
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(L); total += L;
  }
  sim.route = {
    pts, seg, total,
    s: 0,
    speedPerFrame: (o.speedMps === undefined ? 4.5 : Number(o.speedMps)) / 60,
    laps: o.laps === undefined ? 1 : Number(o.laps),
    lap: 0,
    done: false,
    frames: 0,
  };
  // Place the controller on the first point immediately so frame 0 is already on the route.
  applyRoute(sim);
  return { total_m: total, frames_per_lap: Math.ceil(total / sim.route.speedPerFrame) };
}

export function endRoute(sim) { sim.route = null; }

/** Advance one frame along the polyline and write the controller position. */
export function stepRoute(sim) {
  const r = sim.route;
  if (!r || r.done) return;
  r.s += r.speedPerFrame;
  r.frames++;
  if (r.s >= r.total) {
    r.lap++;
    if (r.lap >= r.laps) { r.s = r.total; r.done = true; }
    else r.s -= r.total;
  }
  applyRoute(sim);
}

function applyRoute(sim) {
  const r = sim.route;
  const cell = sim.cell;
  let s = r.s, i = 0;
  while (i < r.seg.length && s > r.seg[i]) { s -= r.seg[i]; i++; }
  if (i >= r.seg.length) { i = r.seg.length - 1; s = r.seg[i]; }
  const a = r.pts[i], b = r.pts[i + 1];
  const k = r.seg[i] > 1e-9 ? s / r.seg[i] : 0;
  const x = a[0] + (b[0] - a[0]) * k;
  const z = a[1] + (b[1] - a[1]) * k;
  const p = sim.player;
  p.pos[0] = x;
  p.pos[2] = z;
  p.pos[1] = cell ? groundYInCell(cell, x, z) : 0;
  p.grounded = true;
  // The combat body is the authority (sim/combat-bridge.js); writing only the view would be
  // undone by `mirror()` on the next frame's stepCombat.
  const body = sim.combatBody;
  if (body) { body.pos[0] = x; body.pos[1] = p.pos[1]; body.pos[2] = z; body.hasPrev = false; }
}
