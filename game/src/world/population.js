/**
 * THE HOSTILE POPULATION OF THE PROVINCE, STREAMED FROM THE FIXED STEP.
 *
 * The defect this exists to close, stated as the souls builder measured it: every hand-placed
 * enemy in Black Marsh was worth **1,224 souls put together — level 3** — against `RI-PRG06`'s
 * plan of roughly 1,230 enemies and a first clear at level 82. Nine bodies, one statblock. The
 * soul economy was correct and the world was empty.
 *
 * It was empty for a structural reason and not a lazy one. The only thing in the build that
 * placed a hostile was one line of `Engine.applyNamedState()`:
 *
 *     for (const e of patch.encounters || []) this.spawnEncounter(e.id, e.x, e.z, e);
 *
 * — so an enemy existed if, and only if, somebody had typed it with coordinates into a
 * hand-written state file. That is exactly the shape of defect W1-GIVER-PRESENCE found on the
 * other side of the same world: a hand-placed scene is precisely as populated as somebody
 * remembered to type. The fix is the same shape too. The placement becomes DATA
 * (`game/data/world/population-posts.json`, generated from `game/data/world/population.json`),
 * and something in the running world reads it as the player moves.
 *
 * WHERE IT IS PUMPED FROM, and why. `Engine._streamPopulation()` calls `step()` here from
 * `Engine._afterStep()`, immediately after `_streamProvince()`. The province-stream builder
 * established that `_afterStep()` is the one slot every way the world advances passes through —
 * `stepFrames`, the rAF accumulator, `walkRoute`, `walkPath`, `travelRide` — and that it sits
 * outside `armSim()`, so spawning bodies here is not a determinism hazard charged to the
 * simulation. A population that only appeared on a teleport would be the streaming defect all
 * over again, one layer up.
 *
 * WHAT IT MAY NOT DO, and each of these has a name:
 *
 *  - **S5.** It may not respawn anything the death system says does not respawn. It never
 *    decides that question: it spawns exclusively through `Engine.spawnEncounter()` →
 *    `Engine.spawn()`, so `_classifyOnSpawn()` runs on every body it makes and
 *    `game/data/world/respawn.json` stays the authority. `sim.npcs` — every named person,
 *    merchant, trainer and quest actor — is a different array and nothing in this file touches
 *    it. A post that has been cleared stays cleared until `DeathSystem.respawnOrdinary()` runs,
 *    which is the hearth rest and the player death and nothing else.
 *  - **S9.** Nothing here reads the player's level, region-clear count or elapsed playtime.
 *    Density is a function of position and of the region's own `danger_tier`; composition is a
 *    function of tier and a seeded draw taken at BUILD time, not at spawn time.
 *  - **S17.** Nothing here slows the player down to buy itself time. At most one post
 *    materialises per fixed step, exactly as the province streamer builds at most one tile.
 *  - **The test states.** Streaming is gated on the province cell. An arena, an interior, the
 *    showcase and every fixture cell see nothing, because putting wilderness bodies into
 *    `arena_flat` would contaminate every combat probe in the project.
 */

/** Post lifecycle. A post is a place a fight can be, not a fight. */
export const DORMANT = 'dormant';
export const RESIDENT = 'resident';
export const CLEARED = 'cleared';

export class PopulationSystem {
  /**
   * @param {object} model     game/data/world/population.json
   * @param {object} postsDoc  game/data/world/population-posts.json
   */
  constructor(model, postsDoc) {
    this.model = model || null;
    this.d = (model && model.stream) || {};
    this.enabled = true;
    this.posts = ((postsDoc && postsDoc.posts) || []).map((p) => ({ ...p }));
    this.byId = new Map(this.posts.map((p) => [p.id, p]));
    this.reset();
  }

  /** Called on every `loadState` and `applySave`: the world is a different world now. */
  reset() {
    this.state = new Map();
    this.live = new Map();          // post id -> [eid]
    this.spawnCentres = new Map();  // post id -> production centre after route-safety placement
    this.down = new Map();          // post id -> Set(eid) that was DEAD when the post was released
    this.focus = { x: NaN, z: NaN };
    this.epochSeen = -1;
    this.stats = { spawned: 0, released: 0, cleared: 0, uncleared: 0, refocuses: 0, steps: 0, skipped_cell: 0 };
    for (const p of this.posts) this.state.set(p.id, DORMANT);
    this.candidates = [];
  }

  countIn(s) { let n = 0; for (const v of this.state.values()) if (v === s) n++; return n; }

  /**
   * One fixed step. `engine` is the live Engine; nothing is stored from it.
   *
   * The order matters and is the order a Souls level behaves in: notice what has died, let go of
   * what is behind you, then bring on what is in front of you.
   */
  step(engine) {
    if (!this.enabled || !this.posts.length) return;
    const sim = engine.sim;
    if (engine.cellFor(sim.env) !== 'province') { this.stats.skipped_cell++; return; }
    this.stats.steps++;

    // (0) S5. `DeathSystem.respawnOrdinary()` bumps `ordinaryRespawnEpoch` on a hearth rest and
    // on a player death. It revives the ordinary bodies that are RESIDENT; the posts the player
    // cleared an hour ago and walked away from are not entities any more, so nothing else in the
    // build could bring them back. Un-clearing them here is what makes RI-PRG04 §1's "every
    // non-unique hostile in the world returns, including ones killed hours ago" true of a world
    // bigger than the streaming radius.
    const epoch = (engine.death && engine.death.ordinaryRespawnEpoch) || 0;
    if (epoch !== this.epochSeen) {
      if (this.epochSeen >= 0) {
        for (const [id, s] of this.state) {
          if (s === CLEARED) { this.state.set(id, DORMANT); this.stats.uncleared++; }
        }
        // ...and the PARTLY cleared ones. `this.down` is the register of bodies the player put
        // down at a post they did not finish; the rest is what un-does it, for exactly the same
        // reason and on exactly the same event. Clearing it here is what makes RI-PRG04 §1's
        // "every non-unique hostile in the world returns" true of a half-fought post as well as
        // of a finished one — a rest brings the whole post back, and nothing else does.
        this.down.clear();
      }
      this.epochSeen = epoch;
    }

    const px = sim.player.pos[0], pz = sim.player.pos[2];

    // (1) Re-focus. The candidate list is only recomputed after the player has moved
    // `refocus_m`; at the 2.0 m/s walk that is once per four seconds. 144 posts is a linear
    // scan and a grid would be a lie about where the cost is.
    const dx = px - this.focus.x, dz = pz - this.focus.z;
    const R = this.d.refocus_m || 8;
    if (!(dx * dx + dz * dz < R * R)) {
      this.focus.x = px; this.focus.z = pz; this.stats.refocuses++;
      const rel = this.d.release_radius_m || 260;
      this.candidates = [];
      for (const p of this.posts) {
        const d = Math.hypot(p.x - px, p.z - pz);
        if (d <= rel) this.candidates.push({ p, d });
      }
      this.candidates.sort((a, b) => a.d - b.d);
    }

    // (2) Notice what has died. A resident post whose every body is down is CLEARED, and stays
    // cleared through a release — which is the whole point: walking away and coming back is not
    // a respawn, resting is.
    for (const [id, eids] of this.live) {
      if (this.state.get(id) === CLEARED) continue;
      let anyAlive = false;
      for (const eid of eids) { const e = sim.findEntity(eid); if (e && e.hp > 0) { anyAlive = true; break; } }
      if (!anyAlive) { this.state.set(id, CLEARED); this.stats.cleared++; }
    }

    // (3) Let go of what is behind you. `release_radius_m` is 90 m beyond `spawn_radius_m`, for
    // the reason the province streamer needed a tile of hysteresis: a body standing on the
    // boundary otherwise spawns and releases on alternate frames.
    const rel = this.d.release_radius_m || 260;
    for (const [id, eids] of [...this.live]) {
      const p = this.byId.get(id);
      if (Math.hypot(p.x - px, p.z - pz) <= rel) continue;
      // W1-SOULS round 3, and it is this file's own stated intent finally being kept.
      //
      // Step (2) above says it in terms: *"walking away and coming back is not a respawn,
      // resting is"* — and it was true only of a post the player had FINISHED. A post left half
      // fought was released as DORMANT and re-materialised from the encounter template, which
      // rebuilt every member, so five corpses came back as five live full-HP hostiles for the
      // price of a 260 m walk. The souls ledger was accidentally hiding it by refusing to pay
      // for their recycled eids — five real enemies worth nothing, which is what `W1-SOULS-r2`
      // HF-2 measured — and the moment that ledger was corrected to pay per BODY rather than
      // per NAME, the same route became a farm instead. The under-payment and the farm are the
      // same defect seen from two sides, and it is here, not in `sim/souls.js`: **the price of
      // a respawn is the world's to charge.**
      //
      // So a release remembers who was down. `_materialise()` leaves them down, and only
      // `DeathSystem.respawnOrdinary()` — the hearth rest and the player death, step (0) above —
      // clears the register. S5 is then true of a half-fought post as well as of a finished one.
      this.releasePost(engine, id);
    }

    // (4) Bring on what is in front of you, one post per step at most. Four bodies is four
    // `engine.spawn()` calls, each of which builds a combat body and evaluates a rig; the
    // province streamer spreads tile builds for exactly this reason and this is the same budget.
    const spawnR = this.d.spawn_radius_m || 170;
    const cap = this.d.max_resident_posts || 14;
    let budget = this.d.spawn_per_step || 1;
    if (this.live.size >= cap) return;
    for (const c of this.candidates) {
      if (budget <= 0 || this.live.size >= cap) break;
      if (c.p.x === undefined) continue;
      if (this.state.get(c.p.id) !== DORMANT) continue;
      if (Math.hypot(c.p.x - px, c.p.z - pz) > spawnR) break; // sorted by distance
      this._materialise(engine, c.p);
      budget--;
    }
  }

  /**
   * Let go of ONE post, remembering who was down. Step (3)'s body, extracted.
   *
   * It is a method rather than eight lines inside `step()` because `step()` returns early outside
   * the province cell, so every probe that wanted to exercise a release had to REIMPLEMENT it —
   * and one did: `tools/progression/souls-ledger-oracle.mjs` carried its own copy, which is why
   * its delete-the-fix leg for this exact register came back GREEN with the register deleted. Two
   * parallel implementations of one system is how this build had a good detection model and a
   * broken one at the same time; here it was how an ablation measured nothing. There is now one
   * implementation and the probes call it.
   *
   * `this.down` is the register the S5 guarantee rests on: a body the player put down at a post
   * they did not finish stays down when the post comes back, and only `respawnOrdinary()` — the
   * hearth rest and the player death, step (0) — clears it.
   */
  releasePost(engine, id) {
    const eids = this.live.get(id);
    if (!eids) return false;
    const sim = engine.sim;
    const down = this.down.get(id) || new Set();
    for (const eid of eids) {
      const e = sim.findEntity(eid);
      if (!e) continue;
      if (e.hp <= 0) down.add(eid);
      try { engine.despawn(eid); } catch { /* already gone */ }
    }
    if (down.size) this.down.set(id, down); else this.down.delete(id);
    this.live.delete(id);
    this.stats.released++;
    if (this.state.get(id) !== CLEARED) this.state.set(id, DORMANT);
    return true;
  }

  _materialise(engine, p) {
    // IDEMPOTENCE, and this was found by an instrument that was not looking for it.
    //
    // `tools/progression/souls-ledger-oracle.mjs` enumerates world-event routes and asserts "an
    // eid last observed dead is never observed alive again without a rest". It went red on two
    // routes out of 463, both of which materialise a post that is ALREADY standing —
    // `kill_some > release > materialise > materialise > materialise` and
    // `save_load > kill_all > materialise > release > materialise`.
    //
    // The cause is that **`Engine.spawnEncounter()` is not atomic**: it spawns members in order
    // and `Engine.spawn()` THROWS on a duplicate eid, so a post whose survivor is still standing
    // spawns every member BEFORE it — alive, at full HP, including the ones the player killed —
    // and then throws. The `catch` below marks the post CLEARED and returns, so those bodies are
    // in the world and in nothing's index: untracked, live, and free.
    //
    // Step (4) happens to guarantee `DORMANT` before it calls here, so no player reaches it
    // today. That guarantee lives in the CALLER, which is exactly the shape of defect this piece
    // has just spent a round on, so it is made a property of this function instead: a post whose
    // bodies are already in the world is not materialised. Cheap — at most one post is
    // materialised per fixed step — and it makes the next caller's mistake harmless.
    const prefix = `${p.id}-`;
    if (this.live.has(p.id) || engine.sim.entities.some((e) => String(e.eid).startsWith(prefix))) {
      this.stats.refused_double_materialise = (this.stats.refused_double_materialise || 0) + 1;
      return;
    }
    // `tag` is why `spawnEncounter` grew one optional field. It names its bodies
    // `${encounterId}-${role}-${i}`, and `Engine.spawn()` THROWS on a duplicate eid — so two
    // posts of the same template resident at the same time would have killed the fixed step the
    // first time the player walked a stretch of road with two marsh sentries on it. The tag is
    // the post id, which is unique by construction.
    let r;
    const centre = this._routeSafeCentre(engine, p);
    try {
      r = engine.spawnEncounter(p.encounter, centre.x, centre.z, { tag: p.id, yaw: p.yaw });
    } catch (err) {
      // A post that cannot be built is a data fault, not a reason to take the step down. It is
      // recorded and never retried.
      this.state.set(p.id, CLEARED);
      (this.faults ||= []).push({ post: p.id, encounter: p.encounter, error: String((err && err.message) || err) });
      return;
    }
    // The bodies the player already put down at this post stay down. See the block in step (3):
    // the eids are deterministic (`${p.id}-${role}-${i}`, and `p.id` is unique by construction),
    // so the register survives the release that emptied the entity array. Despawning rather than
    // spawning-them-dead keeps `sim.entities` free of corpses nobody can interact with, and it
    // is what makes the souls ledger's LAZY SEEDING correct here rather than merely safe: a body
    // that is not in the world is not a body the ledger has to have an opinion about.
    const down = this.down.get(p.id);
    const live = [];
    for (const eid of r.eids) {
      if (down && down.has(eid)) {
        try { engine.despawn(eid); } catch { /* never spawned */ }
        this.stats.left_down = (this.stats.left_down || 0) + 1;
        continue;
      }
      const e = engine.sim.findEntity(eid);
      if (e) { e.populationPost = p.id; e.populationRegion = p.region; e.populationTier = p.tier; }
      live.push(eid);
    }
    this.live.set(p.id, live);
    this.spawnCentres.set(p.id, centre);
    this.state.set(p.id, RESIDENT);
    this.stats.spawned++;
  }

  /**
   * Keep a road encounter's actual bodies off a narrow coastal carriageway.
   *
   * Generated posts sit 5–14 m to one side of a road. Usually a player can take the unused
   * shoulder. At a coast, however, the generated side can end immediately in W4 water: the
   * post's 24 m body-clearance disc then joins the shoreline and topologically seals the only
   * walkable road. That is what pop-0119 on Lilmoth–Archon did in the production Q-MAIN-08 run.
   *
   * This is a production placement consumer, not a quest-runner exemption. If the post is less
   * than 24 m from its declared road, materialise it on the nearest production-safe centre at
   * least 31 m from the road, starting with the authored and opposite 35 m shoulders. The nearest
   * road and all candidates are derived from shipped data; no post id, quest id, player state, or
   * progress flag participates.
   */
  _routeSafeCentre(engine, p) {
    const original = { x: p.x, z: p.z, relocated: false, reason: null };
    if (!p || p.kind !== 'road' || !p.leg || !engine.data || !engine.data.roads) return original;
    const leg = (engine.data.roads.legs || []).find((row) => row.id === p.leg);
    if (!leg || !Array.isArray(leg.points) || leg.points.length < 2) return original;
    let near = null;
    for (let i = 1; i < leg.points.length; i++) {
      const a = leg.points[i - 1], b = leg.points[i], dx = b[0] - a[0], dz = b[1] - a[1];
      const d2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / d2));
      const x = a[0] + dx * t, z = a[1] + dz * t, d = Math.hypot(p.x - x, p.z - z);
      if (!near || d < near.d) near = { x, z, d, dx, dz };
    }
    if (!near || near.d >= 24) return original;
    const dl = Math.hypot(near.dx, near.dz) || 1, nx = near.dz / dl, nz = -near.dx / dl;
    const side = ((p.x - near.x) * nx + (p.z - near.z) * nz) >= 0 ? 1 : -1;
    const candidate = (sign) => ({ x: near.x + nx * 35 * sign, z: near.z + nz * 35 * sign });
    const safe = (q) => {
      // The shipped largest offset is 6.55 m. Sample a 7 m footprint in all directions so a
      // safe centre cannot put one of its bodies in water or a visible collision primitive.
      for (let i = -1; i < 16; i++) {
        const x = i < 0 ? q.x : q.x + Math.sin(i * Math.PI / 8) * 7;
        const z = i < 0 ? q.z : q.z + Math.cos(i * Math.PI / 8) * 7;
        const w = engine.getWaterAt(x, z), water = Number(w.depth_m ?? w.depth ?? 0);
        const terrain = engine.getTerrainAt(x, z);
        if (water > .95 || (terrain.substrate === 'SUCK' && water > .4)
          || terrain.slope_deg > 35 || engine.solidAt(x, Number(w.ground_y) + .9, z).distance_m < .42) return false;
      }
      return true;
    };
    const authoredSide = candidate(side), opposite = candidate(-side);
    const authoredSafe = safe(authoredSide), oppositeSafe = safe(opposite);
    // Every road post whose authored centre lies inside the hard clearance uses the full 35 m
    // post envelope. Body count cannot stand in for perception: a two-body drowned pair still
    // sees far enough for its spawn offsets to seal a narrow tideway.
    let chosen = authoredSafe ? authoredSide : (oppositeSafe ? opposite : null);
    const roadDistance = (q) => {
      let best = Infinity;
      for (let i = 1; i < leg.points.length; i++) {
        const a = leg.points[i - 1], b = leg.points[i], dx = b[0] - a[0], dz = b[1] - a[1];
        const d2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((q.x - a[0]) * dx + (q.z - a[1]) * dz) / d2));
        best = Math.min(best, Math.hypot(q.x - (a[0] + dx * t), q.z - (a[1] + dz * t)));
      }
      return best;
    };
    if (chosen && roadDistance(chosen) < 31) chosen = null;
    if (!chosen) {
      const radial = [];
      for (const radius of [35,45,55,65,80]) for (let i = 0; i < 32; i++) {
        const q = { x: near.x + Math.sin(i * Math.PI / 16) * radius, z: near.z + Math.cos(i * Math.PI / 16) * radius };
        const road = roadDistance(q);
        if (road >= 31 && safe(q)) radial.push({ ...q, road, radius, moved: Math.hypot(q.x - p.x, q.z - p.z) });
      }
      if (radial.length) chosen = radial.sort((a,b) => a.moved - b.moved || b.road - a.road)[0];
    }
    if (!chosen) return original;
    return {
      x: chosen.x, z: chosen.z, relocated: true,
      reason: chosen === authoredSide
        ? 'road-clearance: road post moved to its production-safe 35 m authored shoulder'
        : chosen !== opposite
          ? 'road-clearance: road post moved to nearest production-safe centre with 24 m body clearance'
        : 'road-clearance: authored 35 m shoulder unsafe; opposite 35 m shoulder production-safe',
      authored: [p.x, p.z], road_nearest: [near.x, near.z], road_distance_before_m: near.d,
      post_envelope_m: 35, hard_body_clearance_m: 24, spawn_footprint_sample_m: 7,
      road_clearance_after_m: roadDistance(chosen),
    };
  }

  /** Read-only route-safety placement for a named post; used by production navigation evidence. */
  placement(engine, id) {
    const p = this.byId.get(String(id));
    if (!p) return null;
    return { post: p.id, authored: [p.x, p.z], ...this._routeSafeCentre(engine, p) };
  }

  /**
   * Re-index population bodies restored by the save system and migrate only idle bodies whose
   * saved centre is the superseded authored road placement. The combat bodies survive a load,
   * while reset() deliberately clears this subsystem's live index; without reconciliation the
   * duplicate-eid guard leaves those bodies untracked at the old centre even though route
   * planning reads the corrected production placement.
   *
   * An active/alert/damaged group is never moved. A current save already centred on the safe
   * placement is only re-indexed, so ordinary save/load fidelity remains exact.
   */
  reconcileRestored(engine) {
    if (!engine || !engine.sim) return { groups:0, bodies:0, migrated_groups:0, migrated_bodies:0 };
    const out = { groups:0, bodies:0, migrated_groups:0, migrated_bodies:0 };
    for (const p of this.posts) {
      const prefix = `${p.id}-`;
      const bodies = engine.sim.entities.filter((e) => String(e.eid).startsWith(prefix));
      if (!bodies.length) continue;
      out.groups++; out.bodies += bodies.length;
      this.live.set(p.id, bodies.map((e) => e.eid));
      this.state.set(p.id, bodies.some((e) => e.hp > 0) ? RESIDENT : CLEARED);
      const centre = this._routeSafeCentre(engine, p);
      this.spawnCentres.set(p.id, centre);
      if (!centre.relocated) continue;
      const cx = bodies.reduce((n,e) => n + e.pos[0], 0) / bodies.length;
      const cz = bodies.reduce((n,e) => n + e.pos[2], 0) / bodies.length;
      const atAuthored = Math.hypot(cx-p.x,cz-p.z) < 20;
      const idle = bodies.every((e) => e.hp > 0 && e.state === 'IDLE'
        && (!e.alertState || e.alertState === 'IDLE') && !e.encAggroed);
      if (!atAuthored || !idle) continue;
      const dx=centre.x-p.x,dz=centre.z-p.z;
      const shift = (v) => { if (Array.isArray(v) && v.length >= 3) { v[0]+=dx; v[2]+=dz; } };
      for (const e of bodies) {
        shift(e.pos); shift(e.anchor); shift(e.lkp);
        const body=engine.combat && engine.combat.bodyOf(e.eid);
        if (body) {
          shift(body.pos); shift(body.anchor); shift(body.lkp); shift(body.weaponTip);
          shift(body.socketA); shift(body.socketB); shift(body.prevA); shift(body.prevB);
          for (const capsule of body.rig?.hurt_prev || []) for (const point of capsule || []) shift(point);
          for (const point of body.rig?.body_cap_prev || []) shift(point);
          // The restored SoulsAI owns a separate leash anchor. Leaving that at the legacy
          // authored post would make a nearby, reconciled body walk back into the road on its
          // first idle decision even though its entity and combat body were migrated safely.
          const ctl=engine.combat.enemies?.get(e.eid);
          if (ctl?.ai) shift(ctl.ai.anchor);
        }
        out.migrated_bodies++;
      }
      out.migrated_groups++;
    }
    this.stats.restored_groups = out.groups;
    this.stats.restored_bodies = out.bodies;
    this.stats.migrated_groups = out.migrated_groups;
    this.stats.migrated_bodies = out.migrated_bodies;
    return out;
  }

  /** What a probe reads. Never used by the simulation. */
  report(sim) {
    const resident = [];
    for (const [id, eids] of this.live) {
      const p = this.byId.get(id);
      const alive = eids.filter((eid) => { const e = sim && sim.findEntity(eid); return e && e.hp > 0; }).length;
      const centre = this.spawnCentres.get(id) || { x: p.x, z: p.z, relocated: false };
      resident.push({ post: id, encounter: p.encounter, region: p.region, tier: p.tier, x: centre.x, z: centre.z, authored_x: p.x, authored_z: p.z, route_safety: centre, bodies: eids.length, alive });
    }
    return {
      enabled: this.enabled,
      posts_total: this.posts.length,
      bodies_total: this.posts.reduce((a, p) => a + (p.bodies || 0), 0),
      souls_total: this.posts.reduce((a, p) => a + (p.souls || 0), 0),
      dormant: this.countIn(DORMANT),
      resident: this.countIn(RESIDENT),
      cleared: this.countIn(CLEARED),
      live_posts: this.live.size,
      live_bodies: [...this.live.values()].reduce((a, v) => a + v.length, 0),
      candidates: this.candidates.length,
      stats: { ...this.stats },
      faults: this.faults || [],
      resident_detail: resident,
      stream: { ...this.d },
    };
  }
}
