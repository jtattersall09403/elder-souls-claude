// The HEARTH — a sapwell (`ixtu-xul`), RI-LOR05 §4. The checkpoint, the level-up station,
// and the only place Focus comes back (seam S27).
//
// Owner: wave-1 piece W1-13. Binding: RI-PRG04 §1/§5/§6, RI-JRN06 D6/D9, seams S5, S6, S7, S27.
//
// WHAT THIS FILE IS FOR, and it is worth stating because the field it manages already existed:
// `sim.progression.hearthLastRested` and `sim.progression.hearthsDiscovered` have been in
// `sim/state.js` and in the save since wave 1, and NOTHING in the running game has ever written
// either of them. `game/data/states/sv5-journal-bloodstain.json` names `hearth-thorn` and
// `hearth-drowned-ford`, which resolved to nothing at all. That is the CONSUMPTION defect
// (`RI-MTH07` §A, orphan data) in its purest form: a save that round-trips a value no code path
// can produce and no entity can read. This module is the consumer.
//
// THREE THINGS A HEARTH IS NOT:
//   1. It is not a travel node (S7). `menu()` returns no destination list of any kind, and there
//      is deliberately no method on this class that takes a hearth id and moves the player to it.
//      `respawn` moves you, and only death calls it.
//   2. It is not a place enemies respawn FROM. Respawn scope is `sim/death.js`'s, and it is
//      keyed on a per-entity classification, never on proximity to a well.
//   3. It is not a save. Resting writes no save slot; the game saves on its own terms.
'use strict';

/**
 * RI-PRG04 §2: one in-game day = 48 real minutes; a rest advances the clock 6 in-game hours.
 * The clock is the COST of resting and it is the Morrowind half of the checkpoint. Death does
 * NOT advance it (§6 rule 4) — dying repeatedly at a boss must not burn a quest deadline.
 */
export const REST_HOURS = 6;

export class HearthSystem {
  /**
   * @param {object} doc  game/data/world/hearths.json
   */
  constructor(doc) {
    this.d = doc || { hearths: [], fog_gates: [] };
    this.byId = new Map();
    for (const h of this.d.hearths || []) this.byId.set(h.id, h);
    this.gates = this.d.fog_gates || [];
  }

  list() { return (this.d.hearths || []).map((h) => ({ ...h, pos: [...h.pos] })); }
  get(id) { return this.byId.get(String(id)) || null; }
  count() { return this.byId.size; }

  /** The nearest hearth to a point, with its distance. Null if none are placed. */
  nearest(x, z) {
    let best = null, bd = Infinity;
    for (const h of this.d.hearths || []) {
      const d = Math.hypot(h.pos[0] - x, h.pos[2] - z);
      if (d < bd) { bd = d; best = h; }
    }
    return best ? { hearth: best, dist_m: bd } : null;
  }

  /** The hearth the player is standing at, if any — `interact_radius_m` from its basin. */
  at(x, z) {
    for (const h of this.d.hearths || []) {
      const d = Math.hypot(h.pos[0] - x, h.pos[2] - z);
      if (d <= (h.interact_radius_m || 3.0)) return h;
    }
    return null;
  }

  /**
   * Is the PLAYER standing at a sapwell? The predicate `game/src/engine.js`'s `_uiCtx()` has
   * been calling since the UI was written, and which this class did not have.
   *
   * W1-13 round 2, `GAP-W1-hearth-levelup-gate-reads-a-method-that-does-not-exist`. The gate is
   * `!!(this.hearths && this.hearths.atHearth && this.hearths.atHearth(this.sim))`, so the
   * missing method short-circuited to `undefined` at all 29 wells and the level-up screen —
   * which `RI-PRG04` §1 calls "the only place levelling is possible" — was refused everywhere
   * in the province. The only writer of the other disjunct is `__HARNESS.setAtHearth()`. So the
   * player could bank souls, die, walk back, recover 4,200 of them, and never spend one:
   * `_spendSouls()` has exactly one producer and it is inside `case 'levelup'`.
   *
   * `at(x, z)` was already right — it already tests each well's own `interact_radius_m` and it
   * already backs `listHearths().standing_at`. Only the name the UI calls was missing.
   */
  atHearth(sim) {
    if (!sim || !sim.player || !sim.player.pos) return false;
    return !!this.at(sim.player.pos[0], sim.player.pos[2]);
  }

  /** The boss fog gate whose volume contains (x, z), if any. */
  gateAt(x, z) {
    for (const g of this.gates) {
      if (!g.pos) continue;
      if (Math.hypot(g.pos[0] - x, g.pos[2] - z) <= (g.radius_m || 26)) return g;
    }
    return null;
  }

  /**
   * S7, made checkable rather than asserted. RI-PRG04 method 2 asks that "the HEARTH
   * interaction menu exposes no destination list of any kind"; the only way to make that
   * inspectable is for the menu to be a real returned object that a probe can enumerate.
   */
  menu(id) {
    const h = this.get(id);
    if (!h) return null;
    return {
      hearth: h.id, name: h.name,
      actions: ['rest', 'level_up', 'attune'],
      destinations: [],
      _s7: 'RI-PRG04 §1 / seam S7: a sapwell is a wound, not a door (RI-LOR05 §4). There is no '
        + 'destination list here and there is no method on HearthSystem that takes a hearth id '
        + 'and moves the player to it. Travel is game/src/engine.js boardTravel(): NPC-brokered, '
        + 'gold-priced, fixed routes, real ride time.',
    };
  }
}
