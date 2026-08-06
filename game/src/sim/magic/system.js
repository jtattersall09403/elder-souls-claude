// MagicSystem — seam S19 in one object.
//
// Inside the fight this file is Souls' property and obeys RI-MAG01: a cast is an animated,
// committed action with a readable windup, it spends BOTH Focus and stamina on frame 1, it
// never grants an i-frame, it never draws a random number, and its geometry is a swept volume
// tested every fixed step. Outside the fight it is Morrowind's and obeys RI-MAG02/03/04: the
// content is the effect catalogue and its parameter space, spells are coordinates in that
// space, and the player may commission coordinates no designer wrote.
//
// THREE INVARIANTS THIS FILE EXISTS TO HOLD, each of which a naive implementation breaks:
//
//   1. **Focus never regenerates.** There is no function here that increases `focus` except
//      `hearthRest()` and `respawn()`. RI-MAG01 M3 asserts monotonic non-increase over a
//      20-minute trace, and every bound in RI-MAG02 §F (levitation altitude) and §G (recall
//      range) is denominated in a resource that does not come back.
//   2. **Zero PRNG draws.** Nothing below consults `rng`. Damage, magnitude, duration, contact,
//      status and cost are all arithmetic. RI-MAG01 M5's decisive check is that `rng.draws` is
//      unchanged across a cast; it can be, because there is nothing here to draw for.
//   3. **No prohibition flags.** There is no `no_levitation_zone`, no altitude clamp, no
//      `can_cast_in_combat` boolean. `RITUAL` cannot complete in a fight because it is 210
//      f@60 long and aborts on damage, on `COMBAT` and on movement — the clock does it.
'use strict';

import { focusBase, focusCost, focusMaxFor, spellSlotsFor, skillDiscount, commissionPrice, goldPrice, tierFor } from './cost.js';
import { buildCastMove } from './moves.js';

const DEG = Math.PI / 180;

/** RI-MAG02 §H: global clamps. Morrowind's worst breakage closed by a clamp, not a removal. */
export const CHAMELEON_CLAMP_PCT = 80;
export const RESIST_CLAMP_PCT = 85;

export class MagicSystem {
  /**
   * @param {object} data {effects, spells, castClasses, enchanting}
   */
  constructor(data) {
    this.d = data;
    this.effects = Object.fromEntries(data.effects.effects.map((e) => [e.id, e]));
    this.spells = Object.fromEntries(data.spells.spells.map((s) => [s.id, s]));
    this.classes = Object.fromEntries(data.castClasses.classes.map((c) => [c.id, c]));
    this.ballistics = data.castClasses.ballistics;
    this.lev = data.castClasses.levitation;

    // ---- the caster ------------------------------------------------------------------------
    this.wil = 30;
    this.focusMax = focusMaxFor(this.wil);
    this.focus = this.focusMax;
    this.slots = spellSlotsFor(this.wil);
    this.attuned = ['spark_dart', 'slowfall'];
    this.catalyst = 'none';              // no catalyst until one is equipped
    this.hasCatalyst = false;            // casting requires a catalyst in the right hand
    this.skills = { sorcery: 30, root_speech: 30, warding: 30, veiling: 30 };
    this.knownEffects = new Set();       // effects you own a spell for (the spellmaking gate)
    for (const id of ['spark_dart', 'slowfall']) for (const e of this.spells[id].effects) this.knownEffects.add(e.effect);
    this.gold = 0;

    // ---- live state ------------------------------------------------------------------------
    this.cast = null;                    // {spell, class, spellId, startFrame, focusSpent, staminaSpent, released, aimYaw, aimPitch, tcFrame}
    this.projectiles = [];
    this.volumes = [];
    this.active = [];                    // [{effect, magnitude, remaining_f, source, spell}]
    this.levitating = false;
    this.altitude = 0;                   // metres of net gain, the thing the 1.5/m tax is charged on
    this.airborne = false;
    this.silenced = false;
    this.residues = [];                  // RI-MAG05 L7: every spell leaves residue for 20-90 s

    // ---- the maker's systems ----------------------------------------------------------------
    this.custom = [];                    // spells commissioned at a spellwright, in save order
    this.enchanted = [];                 // items the player made or bought
    this.gems = [];                      // {grade, filled, charge}
    this.xulHesh = 0;
    this.soulHistory = new Map();        // creature instance id -> times trapped (SG-5 downgrade)

    this._moves = new Map();             // spellId -> the Move object, built once
    this.events = [];                    // drained by the trace
    this.stats = { casts: 0, focusSpent: 0, interrupts: 0, ritualAborts: 0, drops: 0, prngDraws: 0 };
  }

  // ============================================================================================
  // RESOURCE
  // ============================================================================================

  setWillpower(wil) {
    this.wil = wil | 0;
    const prev = this.focusMax;
    this.focusMax = focusMaxFor(this.wil);
    this.slots = spellSlotsFor(this.wil);
    // Raising the cap does NOT fill the reservoir. RI-MAG01 §A: nothing refills it but a rest.
    if (this.focusMax < prev) this.focus = Math.min(this.focus, this.focusMax);
    return { focus_max: this.focusMax, slots: this.slots, focus: this.focus };
  }

  /**
   * The ONLY two things in this project that raise `focus`. Both are named in RI-MAG01 M3's
   * exception list; anything else raising it fails the item.
   */
  hearthRest() { this.focus = this.focusMax; this.reattune(); return this.focus; }
  respawn() { this.focus = this.focusMax; return this.focus; }

  /** RI-MAG03 §E2: attunement is re-evaluated against BASE values at every HEARTH rest. */
  reattune() {
    const dropped = [];
    this.attuned = this.attuned.filter((id) => {
      const s = this.spells[id] || this.custom.find((c) => c.id === id);
      if (!s) return false;
      const base = this._baseSkillFor(s);
      if (base < s.skill_req) { dropped.push(id); return false; }
      return true;
    });
    return dropped;
  }

  _baseSkillFor(spell) {
    return Math.min(...spell.schools.map((sc) => this.skills[sc] === undefined ? 0 : this.skills[sc]));
  }

  /** Fortified values satisfy every gate at the instant it is evaluated (RI-EXP06 B-02). */
  _effectiveSkillFor(spell) {
    let s = this._baseSkillFor(spell);
    for (const a of this.active) if (a.effect === 'fortify_skill') s += a.magnitude;
    return s;
  }

  setAttuned(ids) {
    const out = [];
    for (const id of ids) {
      if (out.length >= this.slots) break;
      const s = this.spells[id] || this.custom.find((c) => c.id === id);
      if (!s) throw new Error(`setAttuned: no spell '${id}'. Known: ${Object.keys(this.spells).length} shipped + ${this.custom.length} commissioned.`);
      // RI-PRG03 §6: below the tier requirement a spell cannot be attuned AT ALL. This is why
      // there is no "spell failure" branch anywhere in the cast path — the gate is here.
      if (this._effectiveSkillFor(s) < s.skill_req) continue;
      out.push(id);
    }
    this.attuned = out;
    return out.slice();
  }

  // ============================================================================================
  // CASTING (RI-MAG01, inside the fight, Souls)
  // ============================================================================================

  spellOf(id) { return this.spells[id] || this.custom.find((c) => c.id === id) || null; }

  /**
   * The cast Move, built once per (spell, catalyst-handedness) and cached. Hyperarmour depends
   * on whether the catalyst is two-handed (RI-MAG01 §B), so the key carries it: one-handed
   * casting with a shield or an off-hand weapon has NO hyperarmour at any class.
   */
  moveFor(spellId) {
    const cat = this.d.castClasses.catalysts.find((c) => c.id === this.catalyst);
    const twoHanded = !!(cat && cat.grants_hyperarmour);
    const key = `${spellId}:${twoHanded ? 2 : 1}`;
    let m = this._moves.get(key);
    if (!m) {
      const s = this.spellOf(spellId);
      if (!s) throw new Error(`moveFor: no spell '${spellId}'`);
      m = buildCastMove(s, this.classes[s.class], this.d.castClips, twoHanded);
      this._moves.set(key, m);
    }
    return m;
  }

  setCatalyst(id) {
    if (id === null || id === undefined) { this.catalyst = 'none'; this.hasCatalyst = false; return { catalyst: null, has_catalyst: false }; }
    if (!this.d.castClasses.catalysts.some((c) => c.id === id)) throw new Error(`setCatalyst('${id}'): unknown. Known: ${this.d.castClasses.catalysts.map((c) => c.id).join(', ')}`);
    this.catalyst = id; this.hasCatalyst = true;
    this._moves.clear();
    return { catalyst: id, has_catalyst: true, focus_mult: this.d.castClasses.catalysts.find((c) => c.id === id).focus_mult };
  }

  /** The Focus this cast will actually deduct, at the caster's current skill and catalyst. */
  costOf(spell) {
    return focusCost(spell.focus_base, spell.class, this.catalyst, this._effectiveSkillFor(spell), spell.skill_req);
  }

  /**
   * RI-MAG01 §B's drop rules, evaluated on the frame the cast WOULD begin. Returns a reason
   * string when the input is dropped, or null when the cast may start. Nothing here queues.
   */
  castDropReason(spellId, stamina) {
    const s = this.spellOf(spellId);
    if (!s) return 'not_attuned';
    if (!this.attuned.includes(spellId)) return 'not_attuned';
    if (!this.hasCatalyst) return 'no_catalyst';
    if (this.silenced) return 'silenced';
    if (this.airborne && spellId !== 'slowfall' && !s.effects.some((e) => e.effect === 'slowfall')) return 'airborne';
    const cls = this.classes[s.class];
    if (this.focus < this.costOf(s)) return 'no_focus';
    if (stamina < cls.stamina) return 'no_stamina';
    return null;
  }

  /**
   * Begin a cast. Both resources are spent HERE, on frame 1, and neither is refunded — except
   * a `RITUAL` abort, which is the only refund in RI-MAG01. The caller has already built the
   * move and called `body.begin()`; this records the cast and charges for it.
   */
  beginCast(frame, spellId, aimYaw, aimPitch) {
    const s = this.spellOf(spellId);
    const cls = this.classes[s.class];
    const cost = this.costOf(s);
    this.focus -= cost;                                    // frame 1. Never refunded.
    this.cast = {
      spellId, spell: s, class: s.class, startFrame: frame,
      focusSpent: cost, staminaSpent: cls.stamina,
      released: false, aimYaw, aimPitch,
      tcFrame: cls.Tc, latched: false,
      abortable: s.class === 'RITUAL',
    };
    this.stats.casts++;
    this.stats.focusSpent += cost;
    this._emit(frame, 'cast_start', { spell: spellId, class: s.class, focus_spent: cost, stamina_spent: cls.stamina, focus_after: this.focus, tc_frame: cls.Tc });
    this._emit(frame, 'focus_spend', { spell: spellId, amount: cost, focus_after: this.focus });
    return this.cast;
  }

  /**
   * Aim latch: RI-AI02's tracking-cutoff law, applied to the PLAYER. Before `Tc` the aim may
   * move at up to 120 deg/s with a 100 deg budget; at `Tc` it latches and the spell goes where
   * it was aimed, not where the target now is. RI-MAG01 M4 asserts a MEDIAN residual aim error
   * of >= 25 deg against a strafing target and FAILS below 10 deg — a player whose spells home
   * while the enemy's do not is the same unfairness AR-1 forbids, pointed the other way.
   */
  updateAim(animFrame, wantYaw, wantPitch) {
    const c = this.cast;
    if (!c) return;
    if (animFrame > c.tcFrame) { c.latched = true; return; }
    const cap = this.d.castClasses.commitment.yaw_rate_cap_dps / 60;
    let d = ((wantYaw - c.aimYaw + 540) % 360) - 180;
    if (d > cap) d = cap; else if (d < -cap) d = -cap;
    const budget = this.d.castClasses.commitment.yaw_budget_deg;
    c.yawUsed = (c.yawUsed || 0) + Math.abs(d);
    if (c.yawUsed > budget) { c.latched = true; return; }
    c.aimYaw = (c.aimYaw + d + 360) % 360;
    if (wantPitch !== undefined) c.aimPitch = wantPitch;
  }

  /** The release frame: geometry enters the world. Called once, on `startup + 1`. */
  release(frame, origin) {
    const c = this.cast;
    if (!c || c.released) return null;
    c.released = true;
    const s = c.spell;
    const g = s.geometry;
    let made = null;
    if (g.kind === 'projectile') {
      made = this._spawnProjectile(frame, s, origin, c.aimYaw, c.aimPitch);
    } else if (g.kind === 'volume') {
      made = this._spawnVolume(frame, s, origin, c.aimYaw);
    } else if (g.kind === 'contact') {
      made = this._spawnContact(frame, s, origin, c.aimYaw);
    } else {
      this._applySelf(frame, s);
    }
    this._emit(frame, 'cast_release', { spell: s.id, geometry_kind: g.kind, aim_yaw: round2(c.aimYaw) });
    return made;
  }

  /** RI-MAG01 §D: interrupted during startup, the spell did not happen and the Focus is gone. */
  interrupt(frame, cause) {
    const c = this.cast;
    if (!c) return null;
    if (c.abortable) return this.abortRitual(frame, cause);
    this.stats.interrupts++;
    this._emit(frame, 'cast_interrupt', { spell: c.spellId, cause, released: c.released, focus_refunded: 0 });
    const r = { spell: c.spellId, released: c.released, focus_refunded: 0 };
    this.cast = null;
    return r;
  }

  /**
   * RI-MAG01 §B: a `RITUAL` aborts on damage, on entering `COMBAT`, and on any movement input,
   * and its Focus IS refunded — the only refund in the item. Outside the fight a mis-tap is not
   * a lesson. This, and only this, is what makes "no recall out of a fight" true; there is no
   * flag anywhere that says a ritual may not be cast in combat.
   */
  abortRitual(frame, cause) {
    const c = this.cast;
    if (!c) return null;
    this.focus = Math.min(this.focusMax, this.focus + c.focusSpent);
    this.stats.ritualAborts++;
    this._emit(frame, 'cast_interrupt', { spell: c.spellId, cause, ritual_abort: true, focus_refunded: c.focusSpent, focus_after: this.focus });
    const r = { spell: c.spellId, aborted: true, cause, focus_refunded: c.focusSpent };
    this.cast = null;
    return r;
  }

  endCast() { this.cast = null; }

  // ---- geometry -------------------------------------------------------------------------------

  _spawnProjectile(frame, s, origin, yaw, pitch) {
    const g = s.geometry;
    const p = {
      id: `sp_${s.id}_${frame}`, spell: s.id, owner: 'player',
      pos: [origin[0], origin[1], origin[2]],
      prev: [origin[0], origin[1], origin[2]],
      yaw, pitch: pitch || 0,
      speed: g.speed_mps, r: g.radius_m,
      turnRate: g.turn_rate_dps, cutoffF: g.tracking_cutoff === null ? 0 : Math.round(g.tracking_cutoff * g.lifetime_s * 60),
      travelF: 0, lifeF: Math.round(g.lifetime_s * 60),
      spawnF: frame, hits: [],
    };
    this.projectiles.push(p);
    return p;
  }

  /**
   * RI-MAG01 §E: no `volume` may become active on the frame it spawns, and the ground decal
   * must precede it by >= 20 f@60 with a footprint matching the hitbox within +/-5%. The tell
   * is on the floor because a sphere has no silhouette.
   */
  _spawnVolume(frame, s, origin, yaw) {
    const g = s.geometry;
    const dist = g.placement === 'resolved_world_point' ? 9.0 : 0;
    const rad = yaw * DEG;
    const centre = [origin[0] + Math.sin(rad) * dist, origin[1], origin[2] + Math.cos(rad) * dist];
    const v = {
      id: `sv_${s.id}_${frame}`, spell: s.id, owner: 'player',
      centre, r: g.radius_m,
      decalSpawnF: frame,
      decalR: g.radius_m,                       // footprint area ratio is exactly 1.000
      activeFrom: frame + g.decal_lead_f,
      activeTo: frame + g.decal_lead_f + g.active_f,
      ticksEveryF: g.ticks_every_f, lastTickF: -1,
      hits: [],
    };
    this.volumes.push(v);
    return v;
  }

  _spawnContact(frame, s, origin, yaw) {
    const g = s.geometry;
    const rad = yaw * DEG;
    const v = {
      id: `sc_${s.id}_${frame}`, spell: s.id, owner: 'player', contact: true,
      centre: [origin[0] + Math.sin(rad) * g.reach_m, origin[1], origin[2] + Math.cos(rad) * g.reach_m],
      r: g.radius_m, decalSpawnF: null,
      activeFrom: frame, activeTo: frame + this.classes[s.class].active,
      ticksEveryF: 1, lastTickF: -1, hits: [],
    };
    this.volumes.push(v);
    return v;
  }

  /**
   * One fixed step of every live piece of spell geometry, of every active effect, and of the
   * levitation meter. Called from the combat bridge INSIDE the armed determinism guard, so a
   * clock read or an unseeded draw anywhere beneath this throws rather than desynchronising.
   *
   * @param {number} frame
   * @param {Array} targets combat bodies, in id order (HARNESS D7)
   * @param {function} onHit (target, spell, contact) => void
   */
  step(frame, targets, onHit) {
    // --- projectiles: a SPHERE SWEPT ALONG ITS PER-FRAME PATH, tested every step. Never a
    //     raycast at spawn, never a distance check (RI-MAG01 §E, AP-M1).
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.prev[0] = p.pos[0]; p.prev[1] = p.pos[1]; p.prev[2] = p.pos[2];
      // Tracking, if any, and ONLY before the cutoff. Past it the projectile flies straight;
      // AP-M3 is a projectile still turning past its cutoff and it is an automatic fail.
      p.appliedTurnDps = 0;
      if (p.turnRate > 0 && p.travelF < p.cutoffF && p.target) {
        const want = bearing(p.target.pos[0] - p.pos[0], p.target.pos[2] - p.pos[2]);
        const cap = p.turnRate / 60;
        let d = ((want - p.yaw + 540) % 360) - 180;
        if (d > cap) d = cap; else if (d < -cap) d = -cap;
        p.yaw = (p.yaw + d + 360) % 360;
        p.appliedTurnDps = Math.abs(d) * 60;
      }
      const rad = p.yaw * DEG;
      const step = p.speed / 60;
      p.pos[0] += Math.sin(rad) * step;
      p.pos[2] += Math.cos(rad) * step;
      p.travelF++;
      for (const t of targets) {
        if (t.dead || p.hits.includes(t.id)) continue;
        if (segmentSphereHit(p.prev, p.pos, p.r, t.pos, 0.45)) {
          p.hits.push(t.id);
          onHit(t, this.spellOf(p.spell), { kind: 'projectile', at: [p.pos[0], p.pos[1], p.pos[2]], frame });
          this.projectiles.splice(i, 1);
          this._residue(frame, p.spell, p.pos);
          break;
        }
      }
      if (this.projectiles[i] === p && p.travelF >= p.lifeF) { this.projectiles.splice(i, 1); this._residue(frame, p.spell, p.pos); }
    }

    // --- volumes: re-arm on an INTEGER FRAME PERIOD. Never a per-frame probability.
    for (let i = this.volumes.length - 1; i >= 0; i--) {
      const v = this.volumes[i];
      if (frame < v.activeFrom) continue;
      if (frame > v.activeTo) { this.volumes.splice(i, 1); this._residue(frame, v.spell, v.centre); continue; }
      if (v.lastTickF >= 0 && frame - v.lastTickF < v.ticksEveryF) continue;
      v.lastTickF = frame;
      for (const t of targets) {
        if (t.dead) continue;
        const dx = t.pos[0] - v.centre[0], dz = t.pos[2] - v.centre[2];
        if (dx * dx + dz * dz <= (v.r + 0.45) * (v.r + 0.45)) {
          v.hits.push(t.id);
          onHit(t, this.spellOf(v.spell), { kind: v.contact ? 'contact' : 'volume', at: [v.centre[0], v.centre[1], v.centre[2]], frame });
        }
      }
    }

    // --- active effects: integer frame countdown, never a seconds comparison.
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.remaining_f--;
      if (a.remaining_f <= 0) {
        this._emit(frame, 'effect_expire', { effect: a.effect, source: a.source });
        if (a.effect === 'levitate') this._endLevitation(frame, 'expired');
        this.active.splice(i, 1);
      }
    }

    // --- residue decays (RI-MAG05 L7: 20-90 s of char, rime, scorch, wet patch, spore bloom).
    for (let i = this.residues.length - 1; i >= 0; i--) if (--this.residues[i].remaining_f <= 0) this.residues.splice(i, 1);
  }

  _residue(frame, spellId, at) {
    const s = this.spellOf(spellId);
    if (!s) return;
    this.residues.push({ spell: spellId, at: [at[0], at[1], at[2]], remaining_f: 3600, spawnF: frame });
    if (this.residues.length > 64) this.residues.shift();
  }

  // ============================================================================================
  // EFFECT APPLICATION — deterministic, always
  // ============================================================================================

  /**
   * RI-MAG02 §E: output = M × output_per_point × (1 + gradeCoeff × scalingBonus(stat)).
   * A pure function of two integers and one authored constant. There is no variance term and
   * there is nothing to roll — a magnitude RANGE is a to-hit roll wearing a hat (RI-MAG01 §E).
   */
  outputOf(effectId, magnitude, attrValue) {
    const e = this.effects[effectId];
    const scaling = Math.max(0, (attrValue - 10) / 90);          // 0 at 10, 1 at 99
    const raw = magnitude * e.magnitude.output_per_point * (1 + 0.55 * scaling);
    if (effectId === 'chameleon') return Math.min(CHAMELEON_CLAMP_PCT, raw);
    if (effectId === 'resist_element' || effectId === 'resist_disease') return Math.min(RESIST_CLAMP_PCT, raw);
    return raw;
  }

  applyEffects(frame, spell, target, attrValue) {
    const out = [];
    for (const t of spell.effects) {
      const e = this.effects[t.effect];
      const mag = this.outputOf(t.effect, t.magnitude, attrValue === undefined ? 30 : attrValue);
      const rec = { effect: t.effect, magnitude: mag, remaining_f: Math.round((t.duration_s || 0) * 60), source: spell.id, spell: spell.id, school: e.school };
      if (rec.remaining_f > 0) { this.active.push(rec); }
      this._emit(frame, 'effect_apply', { effect: t.effect, magnitude: round2(mag), duration_f: rec.remaining_f, target: target ? target.id : 'self', spell: spell.id });
      out.push(rec);
      if (t.effect === 'levitate') this._beginLevitation(frame, rec.remaining_f);
      if (t.effect === 'soul_trap') this.xulHesh += 0;   // increments on the TRAP, not the cast
    }
    return out;
  }

  _applySelf(frame, spell) { return this.applyEffects(frame, spell, null, this.wil); }

  /**
   * RI-MAG02 §H / S11: status arrives as a FIXED INTEGER OF BUILDUP PER CONTACT on the
   * status meter — magnitude × 4 for paralysis — and never as a coin flip. A spell that "has a
   * 30% chance to paralyse" fails RI-MAG01 and AR-1 together.
   */
  statusBuildupOf(spell) {
    const out = [];
    for (const t of spell.effects) {
      const e = this.effects[t.effect];
      if (t.effect === 'paralyse') out.push({ kind: 'paralysis', per_contact: t.magnitude * 4 });
      else if (e.status_buildup) out.push({ kind: e.status_buildup.kind, per_contact: e.status_buildup.per_contact });
    }
    return out;
  }

  // ============================================================================================
  // LEVITATION (RI-MAG02 §F) — four bounds, none of them a rule the player can read
  // ============================================================================================

  _beginLevitation(frame, durationF) {
    this.levitating = true;
    this.airborne = true;
    this.altitude = 0;
    this._emit(frame, 'levitate_begin', { duration_f: durationF, drift_mps: this.lev.horizontal_drift_mps, climb_mps: this.lev.climb_rate_mps });
  }

  _endLevitation(frame, cause) {
    if (!this.levitating) return;
    this.levitating = false;
    this.airborne = false;
    this._emit(frame, 'levitate_end', { cause, altitude_m: round2(this.altitude) });
    for (let i = this.active.length - 1; i >= 0; i--) if (this.active[i].effect === 'levitate') this.active.splice(i, 1);
  }

  /**
   * F2: ascent costs an ADDITIONAL 1.5 Focus per metre of net altitude gained, charged
   * continuously out of a reservoir that refills nowhere but a HEARTH. A 40 m ascent is 60
   * Focus on top of the spell, which is most of a WIL-30 caster's entire reservoir. The bound
   * is arithmetic. There is no fence and no volume flag anywhere in the data.
   *
   * Running out of Focus mid-ascent simply stops the climb — you hang at neutral buoyancy,
   * which is what the effect actually is. It does not drop you, and nothing tells you why.
   */
  stepLevitation(frame, climbInput) {
    if (!this.levitating) return { climb_mps: 0, drift_cap_mps: 0 };
    let climb = 0;
    if (climbInput > 0) {
      const want = this.lev.climb_rate_mps / 60 * climbInput;
      const cost = want * this.lev.focus_per_metre_ascent;
      if (this.focus >= cost) {
        this.focus -= cost;
        this.altitude += want;
        climb = want * 60;
        this._emit(frame, 'focus_spend', { reason: 'levitate_ascent', amount: round4(cost), focus_after: round4(this.focus) });
      }
    } else if (climbInput < 0) {
      const want = this.lev.climb_rate_mps / 60 * -climbInput;
      this.altitude = Math.max(0, this.altitude - want);
      climb = -want * 60;                                  // descent is free; only ascent is metered
    }
    return { climb_mps: climb, drift_cap_mps: this.lev.horizontal_drift_mps, altitude_m: this.altitude };
  }

  /** F3: `AIRBORNE` is defenceless, and ANY damage taken ends the effect. You fall. */
  onDamaged(frame) {
    if (this.levitating) this._endLevitation(frame, 'damage');
    if (this.cast && this.cast.abortable) this.abortRitual(frame, 'damage');
  }

  onEnterCombat(frame) {
    if (this.cast && this.cast.abortable) this.abortRitual(frame, 'combat');
  }

  onMovementInput(frame) {
    if (this.cast && this.cast.abortable) this.abortRitual(frame, 'movement');
  }

  // ============================================================================================
  // TELEPORT (RI-MAG02 §G, S7 network) — magnitude is COMPUTED, never authored
  // ============================================================================================

  /**
   * `recall`'s magnitude is the straight-line distance to your mark in hundreds of metres,
   * resolved at cast time. That gives teleport a completely diegetic range limit: you cannot
   * recall from further than your Focus reaches, you cannot get more Focus without resting, and
   * resting is the thing you were trying to avoid. Nobody had to draw a circle on a map.
   */
  recallCost(fromPos, markPos) {
    if (!markPos) return null;
    const dx = fromPos[0] - markPos[0], dz = fromPos[2] - markPos[2];
    const metres = Math.sqrt(dx * dx + dz * dz);
    const M = Math.max(1, Math.round(metres / 100));
    const base = focusBase(this.effects.recall.weight, M, 0, 0, 'self');
    return { metres: round2(metres), M, focus_base: base, focus_cost: focusCost(base, 'RITUAL', this.catalyst, this.skills.warding, 45) };
  }

  interventionCost(fromPos, sites) {
    let best = null;
    for (const s of sites) {
      const dx = fromPos[0] - s.pos[0], dz = fromPos[2] - s.pos[2];
      const m = Math.sqrt(dx * dx + dz * dz);
      if (!best || m < best.metres) best = { site: s.id, metres: m };
    }
    if (!best) return null;
    const M = Math.max(1, Math.round(best.metres / 100));
    const base = focusBase(this.effects.intervention.weight, M, 0, 0, 'self');
    return { site: best.site, metres: round2(best.metres), M, focus_base: base, focus_cost: focusCost(base, 'RITUAL', this.catalyst, this.skills.warding, 25) };
  }

  // ============================================================================================
  // SPELLMAKING (RI-MAG03 §A, outside the fight, Morrowind)
  // ============================================================================================

  /**
   * Price and validate an arbitrary coordinate in the parameter space. NOTHING here consults a
   * list of approved combinations, because there is no such list in this build: a whitelist is
   * an automatic fail of RI-MAG03. Four gates can refuse, and three of them state a number.
   *
   * @param {{effects: Array, range: string, class: string, name?: string}} spec
   */
  quoteSpell(spec) {
    const notes = [];
    const terms = [];
    const schools = new Set();
    if (!Array.isArray(spec.effects) || spec.effects.length === 0) throw new Error('quoteSpell: a spell needs at least one effect');
    for (const t of spec.effects) {
      const e = this.effects[t.effect];
      if (!e) throw new Error(`quoteSpell: no effect '${t.effect}' in the catalogue`);
      if (!e.ranges.includes(spec.range)) return { refused: true, gate: 'range', reason: `'${t.effect}' does not accept range '${spec.range}' (accepts ${e.ranges.join('/')})` };
      // The clamps and forcings are SHOWN, not refused (RI-MAG03 §A).
      let M = Math.max(e.magnitude.min, Math.round(t.magnitude));
      if (M > e.magnitude.max) { notes.push(`${t.effect}: magnitude clamped ${M} -> ${e.magnitude.max}`); M = e.magnitude.max; }
      let D = Math.max(0, Math.round(t.duration_s || 0));
      if (!e.duration.allowed && D > 0) { notes.push(`${t.effect}: duration forced to 0 (this effect is instantaneous)`); D = 0; }
      if (e.duration.allowed && D > e.duration.max_s) { notes.push(`${t.effect}: duration clamped ${D} -> ${e.duration.max_s}s`); D = e.duration.max_s; }
      let A = Math.max(0, t.area_r_m || 0);
      if (!e.area.allowed && A > 0) { notes.push(`${t.effect}: area forced to 0 (this effect has no area)`); A = 0; }
      if (e.area.allowed && A > e.area.max_r_m) { notes.push(`${t.effect}: area clamped ${A} -> ${e.area.max_r_m}m`); A = e.area.max_r_m; }
      terms.push({ effect: t.effect, magnitude: M, duration_s: D, area_r_m: A });
      schools.add(e.school);
    }
    // GATE 1 — effect knowledge. You may only combine effects you already own a spell for.
    const unknown = terms.map((t) => t.effect).filter((id) => !this.knownEffects.has(id));
    if (unknown.length) return { refused: true, gate: 'effect_knowledge', reason: `you do not own a spell for: ${unknown.join(', ')}`, notes };
    // GATE 2 — effect count, from skill. This is the only gate that refuses on a legal tuple.
    const relevant = [...schools].map((s) => this.skills[s] || 0);
    const maxEffects = Math.min(5, 1 + Math.floor(Math.max(...relevant) / 25));
    if (terms.length > maxEffects) {
      return { refused: true, gate: 'effect_count', reason: `${terms.length} effects needs skill ${(terms.length - 1) * 25}; your best relevant school is ${Math.max(...relevant)} (allows ${maxEffects})`, notes };
    }
    let base = 0;
    for (const t of terms) base += focusBase(this.effects[t.effect].weight, t.magnitude, t.duration_s, t.area_r_m, spec.range);
    const bandTier = tierFor(base);
    const floor = Math.max(...terms.map((t) => this.effects[t.effect].min_tier));
    const tier = Math.max(bandTier, floor);
    const req = { 1: 0, 2: 25, 3: 45, 4: 65, 5: 85 }[tier];
    const gold = commissionPrice(base, null, tier);
    const cost = focusCost(base, spec.class, this.catalyst, Math.max(...relevant), req);
    return {
      refused: false, notes,
      effects: terms, range: spec.range, class: spec.class,
      schools: [...schools].sort(),
      focus_base: base, band_tier: bandTier, tier, skill_req: req,
      focus_cost: cost, gold,
      // GATE 3 is not a refusal: a spell over your skill or over your reservoir is MADE and SOLD.
      castable_now: cost <= this.focusMax,
      attunable_now: Math.max(...relevant) >= req,
      over_reservoir: cost > this.focusMax,
    };
  }

  /** Commission it. Gold is the only currency (S15) and it is the only thing that can refuse here. */
  makeSpell(spec, name) {
    const q = this.quoteSpell(spec);
    if (q.refused) return q;
    if (this.gold < q.gold) return { refused: true, gate: 'gold', reason: `costs ${q.gold} g; you have ${this.gold} g`, quote: q };
    this.gold -= q.gold;
    const id = `custom_${this.custom.length + 1}_${(name || 'unnamed').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24)}`;
    const cls = this.classes[spec.class];
    const rec = {
      id, name: name || `Made spell ${this.custom.length + 1}`, custom: true,
      schools: q.schools, school: q.schools[0], class: spec.class, range: spec.range,
      effects: q.effects, focus_base: q.focus_base, band_tier: q.band_tier, tier: q.tier,
      skill_req: q.skill_req, stamina: cls.stamina, gold_price: q.gold,
      geometry: this._geometryFor(spec, q),
      frames: { startup: cls.startup, active: cls.active, recovery: cls.recovery, total: cls.total, Ps: cls.Ps, Tc: cls.Tc, hard_until: cls.hard_until, unit: 'f@60' },
    };
    this.custom.push(rec);
    for (const t of q.effects) this.knownEffects.add(t.effect);
    return { refused: false, spell: rec, quote: q };
  }

  _geometryFor(spec, q) {
    if (spec.class === 'RITUAL') return { kind: 'none' };
    const b = this.ballistics.classes[spec.class];
    const area = Math.max(...q.effects.map((t) => t.area_r_m));
    if (area > 0 || spec.range === 'area_at_range') {
      return { kind: 'volume', shape: 'sphere', radius_m: Math.max(area, 1), active_f: 6, ticks_every_f: 12, decal_lead_f: this.ballistics.volume_decal_lead_f, placement: spec.range === 'area_at_range' ? 'resolved_world_point' : 'caster' };
    }
    if (spec.range === 'projectile' || spec.range === 'target') {
      return { kind: 'projectile', radius_m: b.radius_m, speed_mps: b.speed_mps, turn_rate_dps: b.turn_rate_dps, tracking_cutoff: b.tracking_cutoff, lifetime_s: b.lifetime_s };
    }
    if (spec.range === 'touch') return { kind: 'contact', radius_m: 0.30, reach_m: 1.6 };
    return { kind: 'none' };
  }

  /** Buying a spell teaches you its effects — which is what makes a cheap tier-1 a real purchase. */
  learnSpell(id) {
    const s = this.spells[id];
    if (!s) throw new Error(`learnSpell: no spell '${id}'`);
    for (const e of s.effects) this.knownEffects.add(e.effect);
    return [...this.knownEffects];
  }

  // ============================================================================================
  // ENCHANTING + THE S15 FIREWALL (RI-MAG03 §B, §C)
  // ============================================================================================
  //
  // NOTE FOR ANY FUTURE READER, and for the critic checking SG-1: the word `souls` does not
  // appear as a read or a write anywhere in this section. Sap-debt and gem-charge are different
  // substances in the fiction (RI-LOR05 §3) and different quantities in the code, and the two
  // economies never touch at any point. That is what makes the gem system ADDITIVE rather than
  // a second currency, and it is the clause a critic checks first.

  enchantPoints(focus_base, kind) {
    const k = this.d.enchanting.enchantment_kinds[kind];
    if (!k) throw new Error(`enchantPoints: unknown kind '${kind}'`);
    return Math.ceil(focus_base * k.points_multiplier);
  }

  enchantQuote(spec) {
    const { itemClass, kind, effects, range, enchanter, soulGrade } = spec;
    const cap = this.d.enchanting.item_capacity[itemClass];
    if (cap === undefined) throw new Error(`enchantQuote: unknown item class '${itemClass}'`);
    const K = this.d.enchanting.enchantment_kinds[kind];
    // `constant` forces duration to 0 in the formula and needs a greater or grand soul.
    let base = 0;
    for (const t of effects) {
      const D = kind === 'constant' ? 0 : (t.duration_s || 0);
      base += focusBase(this.effects[t.effect].weight, t.magnitude, D, t.area_r_m || 0, range);
    }
    const points = this.enchantPoints(base, kind);
    const ench = this.d.enchanting.enchanters.find((e) => e.id === enchanter);
    if (!ench) throw new Error(`enchantQuote: unknown enchanter '${enchanter}'`);
    const maxPoints = ench.id === 'self'
      ? Math.floor(0.9 * Math.max(...Object.values(this.skills)))
      : ench.max_points;
    const gold = ench.gold_multiplier === 0 ? 0 : Math.round(Math.round(6.5 * Math.pow(points, 1.35)) * ench.gold_multiplier);
    const problems = [];
    if (points > cap) problems.push(`${points} points does not fit a ${itemClass} (capacity ${cap})`);
    if (points > maxPoints) problems.push(`${points} points exceeds ${ench.name}'s ceiling of ${maxPoints}`);
    if (K.requires_soul_grade && !K.requires_soul_grade.includes(soulGrade)) problems.push(`a ${kind} enchantment needs a greater or grand soul; you offered ${soulGrade}`);
    const grade = this.d.enchanting.soul_gems.grades.find((g) => g.id === soulGrade);
    if (!grade) problems.push(`no such soul grade '${soulGrade}'`);
    return {
      ok: problems.length === 0, problems,
      focus_base: base, points, capacity: cap, enchanter_ceiling: maxPoints,
      gold, charge_pool: grade ? grade.charge : 0,
      charge_per_activation: kind === 'constant' ? 0 : base * K.charge_per_activation_multiplier,
      // SG-4: an enchantment adds full value on purchase and ZERO on sale.
      adds_sale_value: 0,
    };
  }

  /** SG-3: a filled gem has `sell_value: null` — there is no transaction here, at any price. */
  sellValueOfFilledGem() { return null; }

  /** SG-5: a respawned individual yields one grade lower than its first death, floored at petty. */
  soulGradeFor(instanceId, declaredGrade) {
    const order = this.d.enchanting.soul_gems.downgrade_on_respawn.order;
    const seen = this.soulHistory.get(instanceId) || 0;
    const i = Math.min(order.length - 1, order.indexOf(declaredGrade) + seen);
    return order[i < 0 ? order.length - 1 : i];
  }

  trapSoul(frame, instanceId, declaredGrade, isSpeaker) {
    // NPC souls cannot be trapped. The Focus is still spent — the caller has already spent it.
    if (isSpeaker) { this._emit(frame, 'soul_trap_refused', { reason: 'speaker', instance: instanceId }); return { trapped: false, reason: 'npc_souls_cannot_be_trapped' }; }
    const grade = this.soulGradeFor(instanceId, declaredGrade);
    this.soulHistory.set(instanceId, (this.soulHistory.get(instanceId) || 0) + 1);
    this.gems.push({ grade, filled: true, charge: this.d.enchanting.soul_gems.grades.find((g) => g.id === grade).charge });
    this.xulHesh++;                       // SG-6. The player is never told this exists.
    this._emit(frame, 'soul_trapped', { grade, instance: instanceId, xul_hesh: this.xulHesh });
    return { trapped: true, grade, xul_hesh: this.xulHesh };
  }

  /** SG-6: the social consequence. It never touches a frame, a hitbox, a telegraph or damage. */
  xulHeshConsequences() {
    const c = this.d.enchanting.s15_firewall.SG_6.consequences;
    const disp = c.find((x) => x.kind === 'disposition');
    return {
      xul_hesh: this.xulHesh,
      argonian_disposition_delta: Math.max(disp.floor, Math.round(this.xulHesh * disp.per_point * 10) / 10),
      deep_kin_closed: this.xulHesh >= c.find((x) => x.kind === 'faction_gate_close').at,
      enchanting_interest_open: this.xulHesh >= c.find((x) => x.kind === 'faction_gate_open').at,
      visible_taint: this.xulHesh >= c.find((x) => x.kind === 'visible_taint').at,
      affects_combat: false,
      ui_explains_penalty: false,
    };
  }

  // ============================================================================================

  _emit(frame, kind, fields) { this.events.push({ f: frame, kind, ...fields }); if (this.events.length > 4096) this.events.shift(); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  /** The block the trace and `getPlayerStats()` read. Allocation is fine: both run outside the step. */
  report(frame) {
    const c = this.cast;
    return {
      focus: round4(this.focus), focus_max: this.focusMax,
      focus_locked: true,                  // true everywhere but a HEARTH — RI-MAG01 §A
      attuned: this.attuned.slice(), slots: this.slots, catalyst: this.catalyst,
      cast: c ? {
        spell: c.spellId, class: c.class, phase: null, anim_frame: null,
        tc_frame: c.tcFrame, aim_latched: !!c.latched,
        focus_spent: c.focusSpent, stamina_spent: c.staminaSpent, released: c.released,
      } : null,
      effects_active: this.active.map((a) => ({ effect: a.effect, magnitude: round2(a.magnitude), remaining_f: a.remaining_f, source: a.source })),
      levitating: this.levitating, airborne: this.airborne, altitude_m: round2(this.altitude),
      projectiles: this.projectiles.length, volumes: this.volumes.length, residues: this.residues.length,
      xul_hesh: this.xulHesh, gems: this.gems.length, custom_spells: this.custom.length,
    };
  }

  /** Live spell geometry as HARNESS §5 hitbox records. `kind` gains "projectile" and "volume". */
  hitboxRecords(frame) {
    const out = [];
    for (const p of this.projectiles) {
      out.push({
        id: p.id, owner: 'player', kind: 'projectile', spell: p.spell,
        a: [r4(p.pos[0]), r4(p.pos[1]), r4(p.pos[2])],
        b: [r4(p.pos[0]), r4(p.pos[1]), r4(p.pos[2])],
        prev_a: [r4(p.prev[0]), r4(p.prev[1]), r4(p.prev[2])],
        prev_b: [r4(p.prev[0]), r4(p.prev[1]), r4(p.prev[2])],
        r: p.r, active_f: p.travelF, speed_mps: p.speed,
        turn_rate_dps: round2(p.appliedTurnDps || 0), travel_f: p.travelF,
        hits: p.hits.slice(),
      });
    }
    for (const v of this.volumes) {
      out.push({
        id: v.id, owner: 'player', kind: v.contact ? 'contact' : 'volume', spell: v.spell,
        a: [r4(v.centre[0]), r4(v.centre[1]), r4(v.centre[2])],
        b: [r4(v.centre[0]), r4(v.centre[1]), r4(v.centre[2])],
        prev_a: [r4(v.centre[0]), r4(v.centre[1]), r4(v.centre[2])],
        prev_b: [r4(v.centre[0]), r4(v.centre[1]), r4(v.centre[2])],
        r: v.r, active_f: frame >= v.activeFrom ? frame - v.activeFrom : -1,
        decal_spawn_f: v.decalSpawnF, decal_r: v.decalR,
        ticks_every_f: v.ticksEveryF, hits: v.hits.slice(),
      });
    }
    return out;
  }
}

// ---- geometry helpers -----------------------------------------------------------------------

/**
 * Continuous swept test: does the segment `prev -> pos`, fattened by `r`, come within `tr` of
 * the target capsule's axis? This is the same construction resolve.js uses for a weapon and it
 * is deliberately NOT a distance check at the end position — a 22 m/s dart moves 0.37 m per
 * step and would tunnel through a 0.45 m body at the wrong frame rate.
 */
function segmentSphereHit(p0, p1, r, c, tr) {
  const R = r + tr;
  const dx = p1[0] - p0[0], dz = p1[2] - p0[2];
  const fx = p0[0] - c[0], fz = p0[2] - c[2];
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return fx * fx + fz * fz <= R * R;
  let t = -(fx * dx + fz * dz) / a;
  t = Math.max(0, Math.min(1, t));
  const qx = fx + dx * t, qz = fz + dz * t;
  return qx * qx + qz * qz <= R * R;
}

function bearing(x, z) { return (Math.atan2(x, z) / DEG + 360) % 360; }
function round2(v) { return Math.round(v * 100) / 100; }
function round4(v) { return Math.round(v * 1e4) / 1e4; }
function r4(v) { return Math.round(v * 1e4) / 1e4; }
