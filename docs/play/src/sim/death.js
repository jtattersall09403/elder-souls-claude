// Death, the bloom, and the run back. The loop that makes a Souls game a Souls game.
//
// Owner: wave-1 piece W1-13 (`combat.death.corpserun`, `combat.death.worldreset`,
// `journey.death.recovery`). Binding: RI-JRN06 §A D1-D18, RI-PRG04 §6, seams S5, S6, S7, S15.
// In-world: the bloom, `teekh-shuja` (RI-LOR05 §4) — "the tithe is heavier than pattern and does
// not travel with you. It stays in the mud where you fell... If you die again before reclaiming
// it, the roots below finish drinking it."
//
// WHAT WAS HERE BEFORE: nothing. `sim.quest.death.bloodstain` has been a field in `sim/state.js`
// and in the save since wave 1, `bloodstain_create`/`bloodstain_recover` have been in the event
// vocabulary since wave 1, and NOT ONE LINE in the tree ever wrote either. The save round-tripped
// a value no code path could produce. `tools/harness/save-audit.mjs` deferred M7 and M19 to
// "RI-JRN06" by name. This module is the runtime those three declarations were waiting for.
//
// THE ONE RULE THAT MATTERS MOST (RI-JRN06 "How we lose" #1, RI-JRN05 "How we lose" #2):
// respawn does NOT reload the region. It touches exactly two things — ordinary hostiles, and the
// player's own pools — and it is written so that the set of things it touches is enumerable by
// reading `_respawnOrdinary()` and `_restorePlayer()` and nothing else. Every world mutation,
// every quest flag, every journal entry, every faction number and every named corpse survives
// because no line below can reach them.
'use strict';

/**
 * D5/D7: the death surface is at most 3.0 s and control returns within 4.0 s of the death frame.
 * 150 frames at 60 Hz is 2.5 s of surface; the respawn itself is a single frame's work, so
 * `time_dead` lands at 2.5 s with 1.5 s of headroom against D7's 4.0 s ceiling.
 */
export const SURFACE_FRAMES = 150;

/** D15: `interact` at <= 1.8 m returns the stored souls. Recovery is by TOUCH (RI-PRG04 §6). */
export const RECOVER_RADIUS_M = 1.8;

/** D3: the stain is clamped to the nearest standable surface within 2.0 m of the death point. */
export const STAIN_CLAMP_M = 2.0;

/**
 * The one line of text the death surface is allowed to carry.
 *
 * RI-JRN06 D5/D18 and "How we lose" #9: no statistics, no tips, no "souls lost", no death count,
 * no time survived. RI-LOR05 §2 supplies the words: "Everything that dies in Black Marsh goes
 * **down**. This is not a belief. In the marsh's own idiom it is plumbing."
 */
export const DEATH_LINE = 'YOU WENT DOWN';

export class DeathSystem {
  /**
   * @param {object} respawnDoc  game/data/world/respawn.json
   * @param {HearthSystem} hearths
   * @param {object} ctx  { standable(x,z), groundAt(x,z), emit(kind), inProvince() }
   */
  constructor(respawnDoc, hearths, ctx) {
    this.d = respawnDoc || { rules: {} };
    this.hearths = hearths;
    this.ctx = ctx || {};
    this.reset();
  }

  /** Volatile per-session state. NOT saved: the durable half is `sim.quest.death.bloodstain`. */
  reset() {
    this.active = false;              // the death surface is up
    this.deathFrame = null;
    this.controllableAt = null;
    this.cause = null;
    this.deaths = 0;                  // this session, for R5 / M-D17
    this.stainsLostToSecondDeath = 0;
    this.lastHp = null;
    this.lastDamageFrame = null;      // D2: the frame HP last went DOWN
    this.lastDamageAmount = 0;
    this.lastGrounded = null;         // D3 fall rule: the last grounded position
    this.lastRespawn = null;
    this.lastRecovery = null;
    this.skipRequestedAt = null;
    this.respawnFallbacks = 0;        // times the nearest-well FLOOR caught a null respawn point
    this.ordinaryRespawnEpoch = 0;    // W1-POPULATION: bumped by respawnOrdinary(); see there
    this.log = [];                    // per-death records, for the journey tool
  }

  /**
   * Put a death that was IN FLIGHT when the save was taken back on its feet. W1-13 round 2,
   * the round-1 verdict's `secondary_observations[0]`.
   *
   * The blob carries `character.hp = 0` and the bloom. Without the four fields below, the very
   * next `observe()` sees `hp <= 0 && !this.active`, calls `die()` with `soulsHeld = 0`, and
   * D16's second-death branch destroys a 4,200-soul bloom against a death that never happened.
   * Measured: 4,200 in, 0 out, on both the browser-restart and the same-session route.
   *
   * Frame stamps arrive RELATIVE (the save rebases the frame counter), so they are rebased
   * against the frame the load reset to. A save taken 149 frames into a 150-frame surface
   * reloads with one frame of surface left, which is the honest answer.
   *
   * @param {object} d    blob.death
   * @param {number} f    the frame the load has reset the simulation to
   */
  restoreInFlight(d, f) {
    if (!d) return null;
    this.deaths = Number(d.deaths_this_session) || 0;
    this.stainsLostToSecondDeath = Number(d.stains_lost_to_second_death) || 0;
    this.lastGrounded = d.last_grounded ? [...d.last_grounded] : null;
    const inf = d.in_flight;
    if (!inf) {
      this.active = false;
      this.deathFrame = null;
      this.controllableAt = null;
      this.cause = null;
      this.skipRequestedAt = null;
      return null;
    }
    this.active = true;
    this.cause = inf.cause || 'combat';
    this.deathFrame = f - (Number(inf.death_frames_ago) || 0);
    this.controllableAt = f + Math.max(0, Number(inf.controllable_in_frames) || 0);
    this.skipRequestedAt = inf.skip_requested ? f : null;
    // `lastHp` is what `observe()` diffs against. Leaving it null after a load makes the first
    // frame look like "HP has not moved" rather than "HP is 0 and the surface is up"; the
    // surface flag above is what stops the re-kill, and this stops a phantom damage event.
    this.lastHp = 0;
    return { active: true, death_frame: this.deathFrame, controllable_at: this.controllableAt };
  }

  // ---- classification (seam S5) -----------------------------------------------------------

  /**
   * Does this entity come back?
   *
   * S5 is absolute and this predicate is the whole of it. It is deliberately written as a
   * chain of REFUSALS with the permissive case last, so that a new entity flag or a new
   * statblock defaults to "never respawns" rather than to "respawns" — the fail-closed
   * direction, because a named NPC wrongly respawned is an AR-1 failure and an ordinary mob
   * wrongly left dead is a shortfall.
   */
  respawns(entity, stat) {
    const R = this.d.rules || {};
    for (const f of R.never_respawn_entity_flags || []) if (entity && entity[f]) return false;
    const id = (stat && stat.id) || (entity && entity.id);
    if (id && (R.never_respawn_ids || []).includes(id)) return false;
    const arch = (entity && entity.archetype) || (stat && stat.archetype);
    if (arch && (R.never_respawn_archetypes || []).includes(arch)) return false;
    const tier = (entity && entity.tier) || (stat && stat.tier);
    if (tier && (R.never_respawn_tiers || []).includes(tier)) return false;
    if (!tier) return false;
    return (R.respawning_tiers || []).includes(tier);
  }

  /** Why an entity is or is not in respawn scope, in words. For the harness and the verdict. */
  respawnReport(sim) {
    return sim.entities.map((e) => ({
      eid: e.eid, id: e.id, archetype: e.archetype, tier: e.tier,
      flags: (this.d.rules.never_respawn_entity_flags || []).filter((f) => e[f]),
      // WHO said so. A protection that came from the world map or from a statblock is a
      // different fact from one a probe hand-fed, and `RI-MTH07` §A is the difference.
      classified_by: e.classifiedBy || null,
      boss_of_gate: e.bossOfGate || null,
      respawns: this.respawns(e, null),
      alive: e.hp > 0,
    }));
  }

  // ---- the world reset (D9) ----------------------------------------------------------------

  /**
   * Bring back every ordinary hostile. The ONLY collections this touches are `sim.entities`
   * and the combat bodies that mirror them; `sim.npcs`, `sim.props`, `sim.world.*` and
   * `sim.quest.*` are not reachable from here, which is how seam S5 and seam S6 are kept —
   * structurally, not by remembering to be careful.
   */
  respawnOrdinary(sim, combat, bus, why) {
    const back = [], held = [];
    for (const e of sim.entities) {
      if (!this.respawns(e, null)) {
        if (e.hp <= 0) held.push({ eid: e.eid, id: e.id, reason: 'S5: not in respawn scope' });
        continue;
      }
      if (e.hp > 0) continue;
      e.hp = e.hpMax;
      e.state = 'IDLE'; e.prevState = null; e.stateEnteredF = sim.frame;
      e.poise = e.poiseMax;
      e.alert = 0; e.alertState = 'IDLE';
      e.stagger = false; e.staggerUntil = 0;
      e.phase = 'none'; e.hitActive = false; e.attackToken = false; e.hitById = '';
      e.hitboxes.length = 0;
      e.speed = 0; e.yawRate = 0;
      e.pos[0] = e.anchor[0]; e.pos[1] = e.anchor[1]; e.pos[2] = e.anchor[2];
      const b = combat && combat.bodyOf(e.eid);
      if (b) {
        b.hp = b.hpMax; b.dead = false; b.state = 'IDLE'; b.move = null;
        b.hitboxActive = false; b.stagger = false; b.hitstop = 0;
        b.pos[0] = e.anchor[0]; b.pos[1] = e.anchor[1]; b.pos[2] = e.anchor[2];
        b.poise = b.poiseMax === undefined ? b.poise : b.poiseMax;
        if (b.pendingReaction !== undefined) b.pendingReaction = null;
        if (typeof b.evaluateRig === 'function') b.evaluateRig(sim.frame);
      }
      back.push(e.eid);
      if (bus) { const ev = bus.emit(sim.frame, 'enemy_respawn'); ev.eid = e.eid; ev.id = e.id; ev.why = why; }
    }
    // The kill register the save has carried since wave 1 and nothing has ever cleared.
    sim.world.enemiesDeadUntilRest.length = 0;
    // W1-POPULATION. THE HALF OF S5 THAT LIVES OUTSIDE `sim.entities`.
    //
    // The loop above brings back every ordinary hostile that is still an entity — which, in a
    // world the player walks across in 55 minutes, means the ones within about 260 m. RI-PRG04
    // §1 says "every non-unique hostile in the world returns, INCLUDING ONES KILLED HOURS AGO",
    // and a mob cleared two kilometres back is not in this array to be revived: the population
    // streamer released it when the player walked away, and remembers only that its post is
    // CLEARED. This counter is the whole coupling — `PopulationSystem.step()` compares it and
    // un-clears every distant post when it moves. It is deliberately a number rather than a
    // callback: nothing here may reach into the population system, because this function's
    // guarantee is that the ONLY collections it can touch are `sim.entities` and the combat
    // bodies, and that is what keeps seams S5 and S6 structural rather than careful.
    this.ordinaryRespawnEpoch = (this.ordinaryRespawnEpoch || 0) + 1;
    return { respawned: back, held_dead: held, why, epoch: this.ordinaryRespawnEpoch };
  }

  // ---- placement (D3, D4, RI-PRG04 §6 bloodstain rules) -------------------------------------

  /**
   * Where the bloom grows.
   *
   * Four rules, in the order RI-PRG04 §6 gives them, and each one is a separate way to destroy
   * a player's souls with geometry:
   *   1. death inside a boss arena -> OUTSIDE the fog gate, so recovering it never requires
   *      re-entering the fight;
   *   2. a fall or an instant-death hazard -> the last grounded position, not the bottom;
   *   3. otherwise the death point, clamped to standable ground within 2.0 m;
   *   4. if nothing within 2.0 m is standable, walk toward the respawn hearth until something
   *      is. Geometry never destroys souls — only a second death does.
   */
  placeStain(sim, deathPos, cause, respawnHearth) {
    const standable = this.ctx.standable || (() => true);
    const ground = this.ctx.groundAt || (() => 0);
    let x = deathPos[0], z = deathPos[2];
    let rule = 'death_point';

    const gate = this.hearths && this.hearths.gateAt(x, z);
    if (gate) {
      // Push out along the bearing from the arena centre to the player, past the gate radius.
      //
      // W1-13 r2: `Math.hypot(dx,dz) || 1` DEGENERATES AT THE CENTRE. Dying on the exact
      // middle of the arena gave (0,0)/1 = (0,0), so the bloom landed at the centre — inside
      // the gate — while the record still read `outside_fog_gate`. Measure-zero in play, and
      // exactly the shape that survives a review because it reports having done the thing it
      // did not do. The fix is a DEFINED bearing rather than a bigger epsilon: when there is
      // no bearing from the centre, push out toward the sapwell the gate is paired with, which
      // is where the player is about to respawn and therefore the direction they will walk
      // back from. Every gate in `hearths.json` names its `hearth`.
      const dx = x - gate.pos[0], dz = z - gate.pos[2];
      let l = Math.hypot(dx, dz);
      let ux, uz;
      if (l > 1e-6) { ux = dx / l; uz = dz / l; } else {
        const well = gate.hearth && this.hearths ? this.hearths.get(gate.hearth) : null;
        const hx = well ? well.pos[0] - gate.pos[0] : 0;
        const hz = well ? well.pos[2] - gate.pos[2] : 0;
        l = Math.hypot(hx, hz);
        // Last resort +x, so the answer is defined even for a gate with no paired well.
        if (l > 1e-6) { ux = hx / l; uz = hz / l; } else { ux = 1; uz = 0; }
        rule = 'outside_fog_gate_from_centre';
      }
      const r = (gate.radius_m || 26) + 3.0;
      x = gate.pos[0] + ux * r; z = gate.pos[2] + uz * r;
      if (rule === 'death_point') rule = 'outside_fog_gate';
    } else if ((cause === 'fall' || cause === 'hazard' || cause === 'drown') && this.lastGrounded) {
      x = this.lastGrounded[0]; z = this.lastGrounded[2];
      rule = 'last_grounded';
    }

    let relocated = 0;
    if (!standable(x, z)) {
      // 3. spiral out to STAIN_CLAMP_M
      let found = null;
      for (let r = 0.25; r <= STAIN_CLAMP_M + 1e-9 && !found; r += 0.25) {
        for (let a = 0; a < 16; a++) {
          const th = (a / 16) * Math.PI * 2;
          const px = x + Math.cos(th) * r, pz = z + Math.sin(th) * r;
          if (standable(px, pz)) { found = [px, pz, r]; break; }
        }
      }
      if (found) {
        x = found[0]; z = found[1]; relocated = found[2];
        rule = rule === 'death_point' ? 'clamped_within_2m' : `${rule}+clamped`;
      } else if (respawnHearth) {
        // 4. D4 — the unreachable-death rule. March toward the hearth until the ground holds.
        const hx = respawnHearth.pos[0], hz = respawnHearth.pos[2];
        const total = Math.hypot(hx - x, hz - z) || 1;
        for (let s = 0.5; s <= total; s += 0.5) {
          const px = x + ((hx - x) / total) * s, pz = z + ((hz - z) / total) * s;
          if (standable(px, pz)) { relocated = s; x = px; z = pz; break; }
        }
        rule = 'relocated_toward_hearth';
      }
    }
    return { pos: [x, ground(x, z), z], rule, relocated_m: +relocated.toFixed(3) };
  }

  // ---- the loop ------------------------------------------------------------------------------

  /**
   * Called once per frame, strictly AFTER the fixed step. Four jobs, in order:
   *   1. remember where the body last stood on solid ground, and the frame HP last fell;
   *   2. if the surface is up, close it when it expires or when an input asks;
   *   3. if HP has reached 0 and the surface is not up, die;
   *   4. otherwise, if a bloom is within reach, drink it.
   */
  observe(sim, combat, bus, opts = {}) {
    const body = combat && combat.player;
    const hp = body ? body.hp : sim.player.hp;

    if (this.lastHp !== null && hp < this.lastHp) {
      this.lastDamageFrame = sim.frame;
      this.lastDamageAmount = this.lastHp - hp;
    }
    this.lastHp = hp;
    // W1-13 r2: "grounded" for the purpose of the fall rule means STANDABLE, not "touching
    // something". The capsule is grounded while wading into water deep enough to drown in, so
    // the round-1 test would have recorded the drowning spot as the last safe ground and put
    // the bloom back in the water the player just died in. `standable` is the same predicate
    // the locomotion uses and it excludes water past the W3/W4 boundary.
    const standable = this.ctx.standable || (() => true);
    if (hp > 0 && sim.player.grounded !== false && sim.player.state !== 'FALL'
        && standable(sim.player.pos[0], sim.player.pos[2])) {
      this.lastGrounded = [sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]];
    }
    // The kill register. `sim.world.enemiesDeadUntilRest` has been in the state model and in
    // the save since wave 1 and no code path has ever pushed an id into it — so the field the
    // save carried was always `[]` and the round trip of an empty array proved nothing. It is
    // written HERE, from the observation loop, rather than at each of the four places a body
    // can die (the resolver, the hazards, the traversal drown, `killEntity`), because one
    // observer that cannot be forgotten beats four writers that can.
    for (let i = 0; i < sim.entities.length; i++) {
      const e = sim.entities[i];
      if (e.hp > 0) continue;
      if (!this.respawns(e, null)) continue;
      if (!sim.world.enemiesDeadUntilRest.includes(e.eid)) {
        sim.world.enemiesDeadUntilRest.push(e.eid);
        sim.world.enemiesDeadUntilRest.sort();
      }
    }

    if (this.active) {
      const skip = this.skipRequestedAt !== null;
      if (skip || sim.frame >= this.controllableAt) {
        return this.respawn(sim, combat, bus, skip ? 'input' : 'elapsed');
      }
      return null;
    }

    if (hp <= 0) return this.die(sim, combat, bus, opts.cause || this._inferCause(sim));
    return this.tryRecover(sim, bus);
  }

  /**
   * What killed you.
   *
   * W1-13 round 2. Round 1 read `sim.player.state === 'FALL'`, which is the one thing that is
   * NEVER true by the time this runs: `traversal._land()` sets the state to DEATH on the same
   * frame it applies the lethal damage, and the death loop runs from `_afterStep()`. A 90 m
   * drop recorded `cause: 'combat'`, `placement_rule: 'death_point'`, so two of `placeStain()`'s
   * four branches were unreachable and one of them (`'drown'`) could not be reached at all.
   *
   * `p.lethalCause` is written by whatever dealt the killing blow (`sim/traversal.js`, in both
   * the fall and the drown path) and cleared by `die()`. The old state test is kept as the
   * second reading, because a body that is still falling when something else kills it did in
   * fact die to the fall.
   */
  _inferCause(sim) {
    const p = sim.player;
    if (p.lethalCause) return p.lethalCause;
    if (p.state === 'FALL') return 'fall';
    if (p.strandedBy) return 'hazard';
    return 'combat';
  }

  /** Any input, on the surface's first frame, ends it (D5 / RI-JRN01 O2). */
  requestSkip(frame) {
    if (!this.active) return false;
    if (this.skipRequestedAt === null) this.skipRequestedAt = frame;
    return true;
  }

  /** D1-D5. HP has reached 0; take control, drop the tithe, put the surface up. */
  die(sim, combat, bus, cause) {
    this.active = true;
    this.deathFrame = sim.frame;
    this.controllableAt = sim.frame + SURFACE_FRAMES;
    this.cause = cause;
    this.skipRequestedAt = null;
    this.deaths++;
    // Consumed. A cause left standing would make the NEXT death a fall.
    sim.player.lethalCause = null;

    const hearth = this.respawnHearth(sim);
    const prev = sim.quest.death.bloodstain;
    const souls = sim.progression.soulsHeld;
    const placed = this.placeStain(sim, sim.player.pos, cause, hearth);

    // D16 / RI-PRG04 §6: exactly one bloom exists, globally. The second death destroys the
    // first the INSTANT the second is created — no grace period, no partial carry-over, and
    // nothing anywhere in this build can retrieve the destroyed one.
    if (prev) this.stainsLostToSecondDeath++;
    sim.quest.death.bloodstain = {
      pos: [placed.pos[0], placed.pos[1], placed.pos[2]],
      souls,
      death_index: this.deaths,
    };
    sim.progression.soulsHeld = 0;

    if (bus) {
      const ev = bus.emit(sim.frame, 'bloodstain_create');
      ev.souls = souls;
      ev.x = placed.pos[0]; ev.y = placed.pos[1]; ev.z = placed.pos[2];
      ev.death_index = this.deaths;
      ev.placement_rule = placed.rule;
      ev.relocated_m = placed.relocated_m;
      ev.replaced_souls = prev ? prev.souls : 0;
      ev.replaced = !!prev;
      const dv = bus.emit(sim.frame, 'death');
      dv.eid = 'player'; dv.cause = cause;
      dv.frames_since_last_damage = this.lastDamageFrame === null ? null : sim.frame - this.lastDamageFrame;
      const sv = bus.emit(sim.frame, 'surface_enter');
      sv.surface = 'death'; sv.line = DEATH_LINE; sv.max_frames = SURFACE_FRAMES;
    }

    // Control is genuinely taken: the body cannot act until the surface closes.
    sim.player.state = 'DEATH';
    if (combat && combat.player) { combat.player.state = 'DEATH'; combat.player.actionableAt = this.controllableAt; }
    sim.player.actionableAt = this.controllableAt;

    const rec = {
      death_index: this.deaths, frame: this.deathFrame, cause,
      souls_held_at_death: souls,
      souls_in_stain: souls,
      stain_pos: [...placed.pos],
      death_pos: [sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]],
      stain_offset_m: +Math.hypot(placed.pos[0] - sim.player.pos[0], placed.pos[2] - sim.player.pos[2]).toFixed(3),
      placement_rule: placed.rule,
      relocated_m: placed.relocated_m,
      replaced_stain_souls: prev ? prev.souls : null,
      frames_since_last_damage: this.lastDamageFrame === null ? null : sim.frame - this.lastDamageFrame,
      respawn_hearth: hearth ? hearth.id : null,
    };
    this.log.push(rec);
    return { event: 'death', ...rec };
  }

  /**
   * D6: the last HEARTH rested at. Not the nearest, not the last one walked past.
   *
   * W1-13 r2 — THE FLOOR UNDER IT. With `hearthLastRested` null the round-1 code returned null,
   * `respawn()` did `if (hearth) { move }` with no `else`, the body did not move, the bloom
   * landed at its feet and 4,200 souls were back within five frames: DEATH WAS FREE. The
   * round-1 builder then used that path as its CONSUMPTION null control, reading a missing
   * floor as a clean control. `_seedStartingHearth()` guards the named-state path and was not
   * called on the `loadState(blob)` path, so any save carrying a null respawn point loaded into
   * a world where dying cost nothing.
   *
   * The fallback is the NEAREST well, and only in the province — an arena or a camera fixture
   * has no wells within kilometres and a probe that dies in one must not be flung across the
   * map. `RI-PRG04` §5's worst time-to-nearest is 10.42 minutes, so the fallback is still a
   * real cost; it is a floor, not a convenience.
   */
  respawnHearth(sim) {
    const id = sim.progression.hearthLastRested;
    const named = id && this.hearths ? this.hearths.get(id) : null;
    if (named) return named;
    if (!this.hearths || !this.hearths.count()) return null;
    const inProvince = this.ctx.inProvince ? this.ctx.inProvince() : false;
    if (!inProvince) return null;
    const n = this.hearths.nearest(sim.player.pos[0], sim.player.pos[2]);
    if (!n) return null;
    // Falling back also DISCOVERS it — you wake there, so you know it.
    sim.progression.hearthLastRested = n.hearth.id;
    if (!sim.progression.hearthsDiscovered.includes(n.hearth.id)) {
      sim.progression.hearthsDiscovered.push(n.hearth.id);
    }
    this.respawnFallbacks = (this.respawnFallbacks || 0) + 1;
    return n.hearth;
  }

  /** D7/D8/D9. Close the surface, put the body back at the well, re-grow what was pruned. */
  respawn(sim, combat, bus, why) {
    const hearth = this.respawnHearth(sim);
    const from = this.deathFrame;
    this.active = false;

    if (hearth) {
      sim.player.pos[0] = hearth.pos[0];
      sim.player.pos[1] = hearth.pos[1];
      sim.player.pos[2] = hearth.pos[2];
      if (combat && combat.player) {
        combat.player.pos[0] = hearth.pos[0];
        combat.player.pos[1] = hearth.pos[1];
        combat.player.pos[2] = hearth.pos[2];
      }
      sim.camera.pivotSnap = true;
      // The body must ARRIVE, not be dragged. `teleport()` resets the traversal and the hazard
      // volumes for exactly this reason ("a teleport is an instrument, not a journey"); a
      // respawn is the same kind of discontinuity and was doing none of it. See the `placed`
      // hook in engine.js, which is the only thing here that knows what a cell reset means.
      if (typeof this.ctx.placed === 'function') this.ctx.placed(sim, combat);
    }

    const restored = this.restorePlayer(sim, combat);
    const reset = this.respawnOrdinary(sim, combat, bus, 'player_death');

    sim.player.state = 'IDLE';
    if (combat && combat.player) { combat.player.state = 'IDLE'; combat.player.actionableAt = sim.frame; }
    sim.player.actionableAt = sim.frame;
    this.lastHp = combat && combat.player ? combat.player.hp : sim.player.hp;

    if (bus) {
      const sv = bus.emit(sim.frame, 'surface_exit');
      sv.surface = 'death'; sv.closed_by = why;
      const ev = bus.emit(sim.frame, 'player_respawn');
      ev.hearth = hearth ? hearth.id : null;
      ev.time_dead_frames = from === null ? null : sim.frame - from;
      ev.enemies_respawned = reset.respawned.length;
      ev.named_held_dead = reset.held_dead.length;
      ev.closed_by = why;
      ev.focus_restored = restored.focus_restored;
    }

    const out = {
      event: 'respawn', at: hearth ? hearth.id : null,
      time_dead_frames: from === null ? null : sim.frame - from,
      closed_by: why,
      ...restored,
      world_reset: reset,
    };
    if (this.log.length) Object.assign(this.log[this.log.length - 1], {
      respawn_frame: sim.frame,
      time_dead_frames: out.time_dead_frames,
      enemies_respawned: reset.respawned.length,
      named_held_dead: reset.held_dead.map((h) => h.eid),
      respawn_pos: [sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]],
    });
    this.lastRespawn = out;
    this.deathFrame = null;
    this.controllableAt = null;
    this.skipRequestedAt = null;
    return out;
  }

  /**
   * D8, exactly and no more: HP full, stamina full, flask charges full, Fatigue full, souls 0
   * (already, at D3), equipment untouched, quick-slot untouched, active TIMED effects expired,
   * diseases RETAINED.
   *
   * The disease line is not an oversight to be tidied later. RI-JRN06 "How we lose" #11: death
   * as a free cure turns the affliction economy into a nuisance with a free solution, and
   * nobody notices until a disease quest is trivially bypassable.
   */
  restorePlayer(sim, combat) {
    const b = combat && combat.player;
    if (b) {
      b.hp = b.hpMax; b.stamina = b.staminaMax;
      if (b.poiseMax !== undefined) b.poise = b.poiseMax;
      // `dead` is the flag the input gate and the resolver read. Leaving it set after a
      // respawn gives back a body at full HP that cannot act and cannot be hit — the exact
      // shape of defect this project keeps finding, where every NUMBER is right and the thing
      // does not work.
      b.dead = false;
      b.move = null; b.hitboxActive = false; b.stagger = false; b.hitstop = 0;
      if (b.pendingReaction !== undefined) b.pendingReaction = null;
      if (b.hitboxes && b.hitboxes.length !== undefined) b.hitboxes.length = 0;
    }
    sim.player.hp = b ? b.hp : sim.player.hpMax;
    sim.player.stamina = b ? b.stamina : sim.player.staminaMax;
    sim.player.estus = sim.player.estusMax === undefined ? sim.player.estus : sim.player.estusMax;

    const expired = [], kept = [];
    const A = sim.quest.afflictions;
    for (let i = A.length - 1; i >= 0; i--) {
      const a = A[i];
      if (a.kind === 'disease' || a.kind === 'curse') { kept.push(a.id); continue; }
      if (a.duration_in_frames === null || a.duration_in_frames === undefined) { kept.push(a.id); continue; }
      expired.push(a.id); A.splice(i, 1);
    }
    return {
      hp: sim.player.hp, hp_max: b ? b.hpMax : sim.player.hpMax,
      stamina: sim.player.stamina,
      flask_charges: sim.player.estus,
      souls_held: sim.progression.soulsHeld,
      timed_effects_expired: expired,
      afflictions_retained: kept,
      focus_restored: null,          // filled in by the engine: seam S27 and the Dry Well
    };
  }

  // ---- recovery (D15) -------------------------------------------------------------------------

  /**
   * Walk into it. RI-PRG04 §6: "no prompt, no cost, no animation, all-or-nothing."
   *
   * That sentence is also what makes M-D15's five conditions pass by construction: there is no
   * interaction window to be knocked out of, so there is no state in which the stain has been
   * consumed and the souls have not been credited. Both writes happen on the same frame, in
   * this order, with nothing between them.
   */
  tryRecover(sim, bus) {
    const s = sim.quest.death.bloodstain;
    if (!s) return null;
    const d = Math.hypot(s.pos[0] - sim.player.pos[0], s.pos[2] - sim.player.pos[2]);
    if (d > RECOVER_RADIUS_M) return null;
    const souls = s.souls;
    sim.progression.soulsHeld += souls;
    sim.quest.death.bloodstain = null;
    if (bus) {
      const ev = bus.emit(sim.frame, 'bloodstain_recover');
      ev.souls = souls; ev.death_index = s.death_index;
      ev.x = s.pos[0]; ev.y = s.pos[1]; ev.z = s.pos[2];
      ev.dist_m = +d.toFixed(3);
    }
    const out = {
      event: 'recover', souls, death_index: s.death_index,
      dist_m: +d.toFixed(3), souls_held: sim.progression.soulsHeld, frame: sim.frame,
    };
    this.lastRecovery = out;
    for (let i = this.log.length - 1; i >= 0; i--) {
      if (this.log[i].death_index === s.death_index) {
        this.log[i].souls_recovered = souls;
        this.log[i].recovered_frame = sim.frame;
        break;
      }
    }
    return out;
  }

  // ---- reporting -------------------------------------------------------------------------------

  /** Everything RI-JRN06's checks read, in one object. */
  report(sim) {
    const s = sim.quest.death.bloodstain;
    return {
      surface_active: this.active,
      surface_line: this.active ? DEATH_LINE : null,
      surface_max_frames: SURFACE_FRAMES,
      surface_frames_left: this.active ? Math.max(0, this.controllableAt - sim.frame) : 0,
      death_frame: this.deathFrame,
      controllable_at: this.controllableAt,
      cause: this.cause,
      deaths_this_session: this.deaths,
      stains_lost_to_second_death: this.stainsLostToSecondDeath,
      bloodstain: s ? { pos: [...s.pos], souls: s.souls, death_index: s.death_index } : null,
      bloodstain_count: s ? 1 : 0,
      souls_held: sim.progression.soulsHeld,
      hearth_last_rested: sim.progression.hearthLastRested,
      hearths_discovered: [...sim.progression.hearthsDiscovered],
      last_damage_frame: this.lastDamageFrame,
      frames_since_last_damage: this.lastDamageFrame === null ? null : sim.frame - this.lastDamageFrame,
      last_respawn: this.lastRespawn,
      last_recovery: this.lastRecovery,
      deaths: this.log.map((r) => ({ ...r })),
      // D18 / M-D9, stated by the system itself so a grep has something to find and a reader
      // has something to check: there is no compensation of any kind in this build.
      compensation: {
        loss_toast: false, retrieval_item: null, insurance: null,
        reduced_death_penalty_option: false, partial_recovery: false, grace_period_frames: 0,
        _note: 'RI-JRN06 D18 is a hard fail if any of these exist. They do not, and this object '
          + 'is the enumeration M-D9 asks for rather than a promise.',
      },
    };
  }
}
