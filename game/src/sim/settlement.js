// Towns, doors and the cells behind them.
//
// Owner: wave-1 piece W1-04. Binding: RI-WLD03 (anatomy), RI-WLD13 (interior/exterior
// continuity), RI-WLD08 (the living world), RI-STL02 §4 (trespass), RI-DLG02 (rumours per town).
//
// WHY THIS FILE EXISTS, stated plainly because the data it consumes was already on disk:
// `game/data/world/settlements/*.json` was loaded into `Engine.data.settlements` and **read by
// nothing**. `game/data/world/interiors/*.json` was read by exactly one expression in the whole
// build — `Object.keys(d.interiors).length`, in `getWorldStats()`. And `sim.env.settlement`,
// which `sim/quest/topic-supply.js` keys the entire per-town rumour book on, had no writer
// anywhere in the world: the only thing that ever set it was `loadState`'s patch. So a town was
// a census row, an interior was a census row, and standing in Lilmoth did not tell the world you
// were in Lilmoth.
//
// That is `RI-MTH07` §A orphan data, three times over. This module is the consumer, and it runs
// inside the fixed step (`sim/step.js`) so a critic can perturb the data and watch the world
// disagree with itself on the next frame.
//
// It does four things and no more:
//
//   1. **Where am I.** Every frame, the nearest settlement whose `radius_m` contains the player
//      becomes `sim.env.settlement`. Crossing the boundary emits `settlement_enter` /
//      `settlement_exit`.
//   2. **Doors.** `interact` within `DOOR_REACH_M` of a building's door enters its interior:
//      `sim.env.interior` is set, and the body is moved to the interior's `continuity.
//      interior_spawn`. Pressing it again inside puts you back on the doorstep you came in by —
//      `continuity.exterior_spawn` — which is RI-WLD13's whole claim reduced to two vectors.
//   3. **Hours.** A shop is shut outside its interior's `open_h`/`close_h`, and a shut shop's
//      door is locked. `shopOpen` used to default to `true` at every call site in the build.
//   4. **Who lives here.** `residentsPresent()` answers, from the SCHEDULE, which of a zone's
//      owners is standing in it right now — which is what `Engine.takeObject()` used to pass as
//      a hardcoded `livesHere: false`.
'use strict';

/** How close your hand has to be to a door. Matches the sapwell's `interact_radius_m` band. */
export const DOOR_REACH_M = 2.6;

export class SettlementSystem {
  /**
   * @param {object[]} settlements  the docs from game/data/world/settlements/
   * @param {object}   interiors    id -> doc, from game/data/world/interiors/
   */
  constructor(settlements, interiors) {
    this.list = (settlements || []).filter((s) => s && s.id);
    this.interiors = interiors || {};
    this.byId = new Map(this.list.map((s) => [s.id, s]));
    // Flat door table, built once. A settlement with 40 buildings is 40 rows; eight settlements
    // is 202. The step scans only the rows of the town you are standing in.
    this.doors = new Map();
    for (const s of this.list) {
      const rows = [];
      for (const b of s.buildings || []) {
        if (b.kind !== 'interior' || !b.door) continue;
        rows.push({ building: b.id, interior: b.interior, name: b.name, door: b.door, service: b.service || null, kind: b.building_kind });
      }
      this.doors.set(s.id, rows);
    }
    // zone id -> interior id, so a property zone can name the door you get to it through.
    this.zoneInterior = new Map();
    for (const id of Object.keys(this.interiors)) {
      for (const z of this.interiors[id].property_zones || []) this.zoneInterior.set(z, id);
    }
  }

  get(id) { return this.byId.get(String(id)) || null; }
  interior(id) { return this.interiors[String(id)] || null; }
  count() { return this.list.length; }

  /** Which town contains this point, if any. Nearest wins when radii overlap. */
  settlementAt(x, z) {
    let best = null, bd = Infinity;
    for (const s of this.list) {
      const d = Math.hypot(s.pos[0] - x, s.pos[2] - z);
      if (d <= (s.radius_m || 60) && d < bd) { bd = d; best = s; }
    }
    return best ? { settlement: best, dist_m: bd } : null;
  }

  /** The door your hand is on, if any. Only doors of the town you are standing in are in reach. */
  doorAt(settlementId, x, z) {
    const rows = this.doors.get(settlementId);
    if (!rows) return null;
    let best = null, bd = Infinity;
    for (const r of rows) {
      const d = Math.hypot(r.door[0] - x, r.door[2] - z);
      if (d <= DOOR_REACH_M && d < bd) { bd = d; best = r; }
    }
    return best ? { ...best, dist_m: Math.round(bd * 1000) / 1000 } : null;
  }

  /**
   * Is this interior open at this hour? `close_h` may exceed 24 (a tavern that shuts at 02:00
   * declares `close_h: 26`) so the wrap is arithmetic rather than a special case.
   */
  isOpen(interiorId, hour) {
    const d = this.interior(interiorId);
    if (!d) return true;
    const a = d.open_h === undefined ? 0 : d.open_h;
    const b = d.close_h === undefined ? 24 : d.close_h;
    if (b - a >= 24) return true;
    const h = ((hour % 24) + 24) % 24;
    return b <= 24 ? (h >= a && h < b) : (h >= a || h < b - 24);
  }

  /**
   * The people whose schedule has them inside this interior at this instant, off the LIVE npc
   * list — not off the record. Perturb a schedule and this answer changes on the same frame.
   */
  occupants(sim, interiorId) {
    const out = [];
    for (const n of sim.npcs) if (n.at === interiorId) out.push(n);
    return out;
  }

  /**
   * "Do you live here?" — RI-STL02 §1's `shared` scope turns on it, and the whole build passed
   * a hardcoded `false`. An owner of one of this zone's rooms who is *in* the interior right now
   * is the answer to a different question, so both are returned.
   */
  residentsPresent(sim, zoneId) {
    const interiorId = this.zoneInterior.get(zoneId) || null;
    const owners = [], present = [];
    for (const n of sim.npcs) {
      if (!n.owns_zones || !n.owns_zones.includes(zoneId)) continue;
      owners.push(n.eid);
      if (interiorId && n.at === interiorId) present.push(n.eid);
    }
    return { interior: interiorId, owners, present };
  }
}

/**
 * THE STEP. Runs from `sim/step.js`, after physics and before the camera, in the same slot the
 * hearth and the route write the controller — so the pivot reads a post-physics position and a
 * door taken on frame N is in frame N's record.
 *
 * Allocation on a boundary crossing only; no draws, no clock. Safe under the armed sim guard.
 */
export function stepSettlement(sim, input, bus) {
  const S = sim.settlements;
  if (!S) return;
  const p = sim.player.pos;

  // ---- 1. which town -------------------------------------------------------------------------
  // Inside an interior you are still in the town: the cell you are in belongs to one.
  let want = null;
  if (sim.env.interior) {
    const d = S.interior(sim.env.interior);
    want = d ? d.settlement : sim.env.settlement;
  } else {
    const hit = S.settlementAt(p[0], p[2]);
    want = hit ? hit.settlement.id : null;
  }
  if (want !== sim.env.settlement) {
    const from = sim.env.settlement;
    sim.env.settlement = want;
    // The people of the town you have just walked into. Installed by the Engine as a hook, the
    // way `sim.settleWorld` and `sim.censusDriver` are, because a system only the Engine can
    // see is a system the fixed step cannot run — and a population that only a probe can
    // summon is not a population.
    if (want && sim.populate) sim.populate(want);
    if (bus) {
      const ev = bus.emit(sim.frame, want ? 'settlement_enter' : 'settlement_exit');
      ev.settlement = want; ev.from = from;
      ev.pos = [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100, Math.round(p[2] * 100) / 100];
    }
  }

  // ---- 2. doors ------------------------------------------------------------------------------
  // The reach is recomputed every frame whether or not `interact` is down, because `sim.door` is
  // what a prompt renders off and a prompt that only appears on the frame you press is no prompt.
  // W1-26 round 2. The way OUT is a place, exactly as the way in is. This line used to read
  // `dist_m: 0` unconditionally, which meant that anywhere inside any interior — the far corner
  // of a shop, the middle of a barge hold — the door was under your hand, and the `interact`
  // latch below took it. Measured in the opening: the player presses `interact` to talk to the
  // woman who is eight metres away, the census's own reach gate correctly declines, the press
  // falls through to here, and the body is placed on the Tidewrack dock 3.9 km away with the
  // scene still paused in a hold it can never get back to. The scene could not be finished, and
  // the probe reported `dist_to_her: 0.272` while it happened because the census measures the
  // speaker in the hold's own frame.
  //
  // The inside face of the door is `continuity.interior_spawn` — the same object's other end,
  // the arithmetic RI-WLD13 already relies on — so the out-door is offered within the same
  // `DOOR_REACH_M` the in-door uses. All 115 interiors in `game/data/world/interiors/**` declare
  // it; the `!inFace` arm is fail-OPEN on purpose, because an interior that somehow shipped
  // without one must not become a room the player cannot leave.
  let outDoor = null;
  if (sim.env.interior) {
    const rec = S.interior(sim.env.interior);
    const inFace = rec && rec.continuity && rec.continuity.interior_spawn;
    const dist = inFace ? Math.hypot(p[0] - inFace[0], p[2] - inFace[2]) : 0;
    if (!inFace || dist <= DOOR_REACH_M) {
      outDoor = { building: sim.env.interior, interior: sim.env.interior, way: 'out', dist_m: Math.round(dist * 100) / 100 };
    }
  }
  sim.door = sim.env.interior
    ? outDoor
    : (sim.env.settlement ? Object.assign({ way: 'in' }, S.doorAt(sim.env.settlement, p[0], p[2]) || {}) : null);
  if (sim.door && !sim.door.interior) sim.door = null;

  if (!input || !input.pressedName || !input.pressedName('interact')) return;
  if (!sim.door) return;
  if (sim.door.way === 'in') { useDoor(sim, sim.door.interior, bus); return; }
  // A scene that is still running can hold the door. `sim.doorVeto` is an Engine-installed hook
  // of the same family as `sim.censusDriver`, `sim.populate` and `sim.placeBody`: this module
  // must not know what a census is, and the opening must not be escapable half-finished. It
  // returns a REASON or null, and a refusal is an event with words in it, never a silent nothing
  // — the same shape `useDoor` already uses for a shop that is shut.
  const veto = typeof sim.doorVeto === 'function' ? sim.doorVeto(sim.env.interior) : null;
  if (veto) {
    if (bus) { const ev = bus.emit(sim.frame, 'door_refused'); ev.interior = sim.env.interior; ev.reason = veto; ev.way = 'out'; }
    return;
  }
  leaveInterior(sim, bus);
}

/**
 * Put the body somewhere, through the authoritative path.
 *
 * `sim.player.pos` IS NOT THE PLAYER POSITION. It is a mirror: `combat-bridge.mirror()` copies
 * `combat.player.pos` into it at the top of every step. This module used to write the mirror,
 * which meant a door taken on frame N was undone on frame N+1 — measured, the body reached the
 * declared interior spawn and was back outside one step later, while `sim.env.interior` stayed
 * set the whole time so nothing looked wrong. `sim.placeBody` is installed by the Engine (which
 * owns `combat`) and moves the real body; the mirror write below is the fallback for the bare
 * sim harnesses that have no combat rig at all, and it is honest only there.
 */
function placeBody(sim, at) {
  if (typeof sim.placeBody === 'function') { sim.placeBody(at[0], at[1], at[2]); return; }
  sim.player.pos[0] = at[0]; sim.player.pos[1] = at[1]; sim.player.pos[2] = at[2];
  if (sim.player.vel) { sim.player.vel[0] = 0; sim.player.vel[1] = 0; sim.player.vel[2] = 0; }
}

/**
 * Go through a door. RI-WLD13: the exterior door position and the interior spawn are two ends of
 * ONE object, both declared in the interior's `continuity` block, so "the door I came out of is
 * the door I went in by" is arithmetic a probe can check rather than a promise.
 */
export function useDoor(sim, interiorId, bus) {
  const S = sim.settlements;
  const d = S.interior(interiorId);
  if (!d) throw new Error(`useDoor: no interior ${JSON.stringify(interiorId)}`);
  const open = S.isOpen(interiorId, sim.env.timeOfDay);
  if (!open && d.interior_kind !== 'dwelling') {
    // A shut shop is a locked door, not an invisible wall, and the refusal says which.
    if (bus) { const ev = bus.emit(sim.frame, 'door_refused'); ev.interior = interiorId; ev.reason = 'closed'; ev.open_h = d.open_h; ev.close_h = d.close_h; ev.hour = Math.round(sim.env.timeOfDay * 100) / 100; }
    return { entered: false, reason: 'closed', open_h: d.open_h, close_h: d.close_h };
  }
  const spawn = (d.continuity && d.continuity.interior_spawn) || [0, 0, 0];
  sim.env.interior = interiorId;
  sim.env.settlement = d.settlement;
  placeBody(sim, spawn);
  if (bus) {
    const ev = bus.emit(sim.frame, 'interior_enter');
    ev.interior = interiorId; ev.settlement = d.settlement; ev.name = d.name;
    ev.zones = (d.property_zones || []).length; ev.pos = [spawn[0], spawn[1], spawn[2]];
  }
  return { entered: true, interior: interiorId, pos: [spawn[0], spawn[1], spawn[2]] };
}

/** Back out onto the doorstep you came in by. */
export function leaveInterior(sim, bus) {
  const S = sim.settlements;
  const id = sim.env.interior;
  const d = S.interior(id);
  if (!d) { sim.env.interior = null; return { left: true, interior: id, pos: null }; }
  const out = (d.continuity && d.continuity.exterior_spawn) || d.exterior_door || [0, 0, 0];
  sim.env.interior = null;
  placeBody(sim, out);
  if (bus) {
    const ev = bus.emit(sim.frame, 'interior_exit');
    ev.interior = id; ev.settlement = d.settlement; ev.pos = [out[0], out[1], out[2]];
  }
  return { left: true, interior: id, pos: [out[0], out[1], out[2]] };
}
