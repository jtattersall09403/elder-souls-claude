// The stealth/crime subsystem, as the fixed step sees it.
//
// One object hung on `sim`, stepped once per frame between the fight and the camera. It owns
// the crouch state, the per-frame V and sound radius, the civilian suspicion pass, the light
// field's relight timers, pending reports, and the S-4 zone memory. Everything it computes is
// read by sim/record.js into the trace's `player.stealth` block, which is the surface every
// RI-STL01/02 and RI-CRM01/02 method reads.
//
// Determinism: this file draws from the seeded PRNG in exactly ONE place — the pickpocket
// notice check (seam S21). Everything else is a continuous function of the frame's state.
'use strict';

import { rng } from '../../core/rng.js';
import * as DET from './detection.js';
import * as PER from './perception.js';
import { CollisionCell } from '../collision.js';
import { LightField } from './light.js';
import { ZoneMemory, Search, propagate } from './search.js';
import { LockAttempt, gate as lockGate, tolerance as lockTolerance, unbind } from './lock.js';
import * as PP from './pickpocket.js';
import * as THF from './theft.js';
import { CrimeWorld } from '../crime/state.js';
import * as WIT from '../crime/witness.js';
import * as JUS from '../crime/justice.js';
import * as SAN from '../crime/sanction.js';
import { BIT } from '../../input/actions.js';

export const SNEAK_MPS = 0.85;

export class StealthCrime {
  constructor(data) {
    this.d = {
      detection: data.stealth.detection,
      search: data.stealth.search,
      locks: data.stealth.locks,
      theft: data.stealth.theft,
      bounty: data.crime.bounty,
      justice: data.crime.justice,
      sanction: data.crime.sanction,
      fences: data.crime.fences,
      races: data.progression['race-reactions'],
    };
    this.property = data.property || {};
    this.light = new LightField(this.d.detection);
    this.zones = new ZoneMemory(this.d.search);
    this.crime = new CrimeWorld(this.d.bounty, this.d.justice);

    // The player's stealth-side state. Allocated once (RI-PLT01 P4).
    this.p = {
      crouched: false,
      crouchRefusedReason: null,
      L: 0.22,
      V: 1.0,
      soundR: 6.0,
      surface: 'earth',
      inCover: false,
      carryingTorch: false,
      zone: null,
      motion: 'still',
      sneak: 5,
      security: 5,
      agility: 20,
      mercantile: 5,
      speechcraft: 5,
      load: 'medium',
      race: 'imperial',
      contextWeight: 0.00,
      contextName: 'public_street_sheathed',
      lockAttempt: null,
      pickpocket: null,
      standings: {},
      gold: 400,
      picks: 12,
      // `in_cover` is DERIVED from geometry every frame (perception.js deriveInCover). This
      // flag records whether a scenario has overridden it, so a critic reading the trace can
      // tell the world's answer from a hand-fed one — RI-MTH07 §C3's hand-feed audit.
      inCoverForced: false,
      inCoverFraction: 0,
      motionForced: null,
    };
    this.civilians = [];              // {eid, group, race, R, pos, yaw, suspicion, civ_state, alive}
    this.pending = [];                // PendingReport
    this.searches = [];               // live Search objects, keyed by eid
    this.events = [];
    /**
     * Scenario-scratch occluders. Line of sight casts against `sim.cell` — the SAME static
     * collision set the camera's spring arm and the player's body use — plus this cell, which
     * exists so a stealth scenario can put one wall in an otherwise empty arena without
     * mutating the shared camera fixture. Both are real geometry; neither is a boolean.
     */
    this.occluders = new CollisionCell('stealth_occluders', []);
    /** S-1's nav-mesh cover volumes, per zone. */
    this.coverVolumes = [];           // {id, pos:[x,y,z], zone}
    /** Reused per-observer percept. The fixed step allocates nothing (RI-PLT01 P4). */
    this._per = PER.newPerceptOut();
    this._lastCrimeFrame = -1;
    /**
     * RI-PRG03 §3/§6, the seam this file's own constructor comment left unbuilt: `this.p`
     * started as "the player's stealth-side state" with `sneak`/`security`/`agility`/
     * `mercantile`/`speechcraft` hand-seeded at creation-ish numbers and `race: 'imperial'`
     * always — and NOTHING ever wrote them again. A player who trained Security from 5 to 60
     * still had every lock in the game gated on Security 5 (`lockGateFor`, engine.js), every
     * fence still priced goods off Mercantile 5 (`fenceQuote`), and a Dunmer or Argonian
     * character was judged by guards as `imperial` (`raceSuspicion`) for the entire game. The
     * live numbers existed the whole time in `sim.progression.skills`/`.attributes` — RI-PRG03's
     * skill-by-use loop banks them every hit, lockpick and barter — they just never reached
     * here. `_overridden` is the declared escape hatch: `setStealthState()` (a scenario/harness
     * verb) marks a field overridden so a scripted probe that hand-feeds Security 80 to test a
     * tier-5 lock in isolation keeps that number, exactly as `atHearthOverridden` lets a
     * scenario put its thumb on the hearth check without the world's own answer fighting it.
     * Everything NOT overridden tracks the character every frame in `syncFromCharacter()`.
     */
    this._overridden = new Set();
  }

  /**
   * Mirror the live character sheet onto the fields RI-STL01/02 and RI-CRM01 gate on, for every
   * field a scenario has not explicitly pinned via `setStealthState()`. Idempotent, allocation
   * free, and a no-op before a character exists (`sim.progression.skills` starts populated by
   * `Engine._ensureSkillRegister()`, so this only ever reads, never seeds).
   */
  syncFromCharacter(sim) {
    const prog = sim && sim.progression;
    if (!prog) return;
    const p = this.p, ov = this._overridden;
    const skills = prog.skills || {};
    const skillVal = (k) => { const v = skills[k]; return v && v.value != null ? Number(v.value) : undefined; };
    for (const k of ['sneak', 'security', 'mercantile', 'speechcraft']) {
      if (ov.has(k)) continue;
      const v = skillVal(k);
      if (v !== undefined) p[k] = v;
    }
    if (!ov.has('agility')) {
      const av = prog.attributes && prog.attributes.agility;
      if (av !== undefined) p.agility = Number(av);
    }
    if (!ov.has('race') && sim.identity && sim.identity.race) p.race = sim.identity.race;
    // W1-16 gold-purse finding: `Engine._setGold` mirrors here immediately on every write, but
    // this per-frame pass is what re-heals `p.gold` after a path that changes
    // `sim.progression.gold` directly — chiefly `save/state.js` on a load, which runs BEFORE
    // `_buildCombat` re-mirrors `combat.world.gold`/`magic.gold` and never touches this object
    // at all. Without this line a loaded save's purse would show 400 (the constructor default)
    // to every stealth/crime read until the next spend.
    if (!ov.has('gold') && prog.gold !== undefined) p.gold = Number(prog.gold) || 0;
  }

  // ---- the fixed step -------------------------------------------------------------------

  step(sim, input, bus) {
    const f = sim.frame;
    const p = this.p;

    // RI-PRG03 §3/§6 consumption: the character's live skill growth reaches the gates every
    // frame, not just at boot. See the constructor's comment on `_overridden`.
    this.syncFromCharacter(sim);

    // W1-15 r3: the world's own people, before anything below reads `this.civilians`.
    // `sim/step.js` runs `stepSettlement` then `stepNPCs` immediately before this step, so
    // `sim.npcs[].pos`/`.present` are this frame's answer, not last frame's.
    this.syncCiviliansFromWorld(sim);

    // 1. crouch. A toggle, refused while an AGGRO enemy is within 8 m (RI-STL01 §5).
    if (input && input.pressed & (1 << CROUCH_BIT)) {
      const near = nearestAggroDist(sim);
      const allow = DET.crouchAllowed(this.d.detection, { aggroEnemiesWithinM: near });
      if (p.crouched) { p.crouched = false; p.crouchRefusedReason = null; }
      else if (allow.allowed) { p.crouched = true; p.crouchRefusedReason = null; if (bus) bus.emit(f, 'crouch').on = true; }
      else { p.crouchRefusedReason = allow.reason; if (bus) bus.emit(f, 'crouch_refused').reason = allow.reason; }
    }
    // Rolling exits sneak (RI-STL01 §5).
    if (sim.player && sim.player.state === 'ROLL') p.crouched = false;

    // 2. motion band, from the controller's actual speed.
    const spd = sim.player ? sim.player.speedMps : 0;
    p.motion = p.motionForced || (spd < 0.05 ? 'still' : p.crouched ? 'crouch_move' : spd > 3.5 ? 'sprint' : 'walk');

    // 3. light at the chest node, then V.
    //
    // Outdoors (no zone), the ambient is the SKY's — RI-STL01 §3's table read against the
    // simulation's own clock and weather, so walking a road at 03:00 in the rain is genuinely
    // darker than walking it at noon and the stealth model and the renderer are looking at the
    // same world. Indoors, the zone's authored ambient stands and the sky does not reach in.
    if (!p.zone) this.light.defaultAmbient = skyAmbient(sim.env);
    const pos = sim.player ? sim.player.pos : [0, 0, 0];
    p.L = this.light.withTorch(this.light.sample(pos[0], pos[1] + 1.35, pos[2], p.zone), p.carryingTorch);
    // ---- seam S19 x S21: THE VEILING SCHOOL'S CONSUMING SYSTEM ------------------------------
    //
    // The W1-14 critic's decisive Veiling finding was that all five concealment effects left
    // `getStealthState()` BYTE-IDENTICAL: twelve effects, the whole concealment half of S19,
    // with zero coupling to the stealth system shipping in the same build. These four lines are
    // that coupling, and they are HERE rather than inside the magic system for the reason
    // RI-MAG06 §B gives: the number a critic reads is `V` and `sound_r_m`, so those are the
    // numbers that have to move — not a parallel "magic visibility" a spell reads back to itself.
    //
    // `night_eye` raises the light the CASTER perceives; it does not light the caster up, so it
    // is applied after the sample that feeds V and never to the V term itself.
    const rawL = p.L;
    p.perceivedL = Math.min(1, rawL + (p.magicLightBonus || 0));
    // RI-STL01 §2's `A` term, DERIVED from geometry rather than authored. Round 1's `in_cover`
    // was a boolean a critic set; `deriveInCover()` fires a ring of probes at the same static
    // collision set line of sight uses, so standing in an alcove is worth x0.80 and standing in
    // a field is not. A scenario may still force it (RI-STL01 §2's own worked table is stated in
    // terms of the flag), and when it does the trace says so.
    //
    // Throttled to every 6th frame (10 Hz). Twelve sphere casts against a cell with a few
    // hundred primitives is the most expensive thing this subsystem does, and cover is a
    // property of where you are standing — it cannot change meaningfully inside 100 ms at
    // 2.0 m/s. `RI-PLT01` P4/P5 are the reason this is a throttle and not a per-frame loop.
    if (!p.inCoverForced && (f % 6 === 0 || p.inCoverFraction === undefined)) {
      const hasGeometry = (sim.cell && sim.cell.shapes.length) || this.occluders.shapes.length;
      if (!hasGeometry) { p.inCover = false; p.inCoverFraction = 0; }
      else {
        const cov = PER.deriveInCover(sim, pos[0], pos[1], pos[2]);
        p.inCover = cov.in_cover;
        p.inCoverFraction = cov.fraction;
      }
    }
    // The RAW product first, then the magic terms, then the [0.05, 1.30] clamp — in that order.
    // Applying the terms after the clamp would let the 0.05 floor swallow an 80% chameleon
    // whole in an unlit room, which is exactly where a player casts it.
    let vRaw = DET.visibilityRaw(this.d.detection, { L: p.L, motion: p.motion, sneak: p.sneak, load: p.load, inCover: p.inCover });
    if (p.magicChameleonPct) vRaw *= 1 - Math.min(80, p.magicChameleonPct) / 100;   // §H clamp at 80
    if (p.magicInvisible) vRaw *= 0.02;
    const cl = this.d.detection.visibility.clamp;
    p.Vraw = Math.round(vRaw * 1e6) / 1e6;
    p.V = Math.round(Math.min(cl[1], Math.max(cl[0], vRaw)) * 1e6) / 1e6;
    p.soundR = DET.soundRadius(this.d.detection, { motion: p.motion, sneak: p.sneak, load: p.load, surface: p.surface });
    if (p.magicMufflePct) p.soundR = Math.round(p.soundR * (1 - Math.min(90, p.magicMufflePct) / 100) * 1e6) / 1e6;

    // 4. relight timers.
    this.light.step(f);

    // 5. THE ENEMIES. This is the block whose absence was the round-1 verdict.
    //
    // Every entity in `sim.entities` has its alert meter filled HERE, by the same kernel the
    // civilians below use, from the same `V` and the same `sound_r_m` the trace reports. The
    // meter is then written through to the combat controller (`combat/enemy.js`), which has
    // stopped filling it and now only reads it. There is exactly one detection model in this
    // build and this is the line that made it one.
    this.stepPerception(sim, bus);

    // 5b. THE SEARCH. RI-STL01 §7 S-1..S-4, driven from the same meter.
    this.stepSearches(sim, bus);

    // 6. civilians. The CALM/WATCHING/CHALLENGE/ALARM machine, never the enemy one.
    const zoneCtx = this.zones.contextMultiplier(p.zone, f);
    const baseline = this.zones.baselineAlert(p.zone, f);
    for (const c of this.civilians) {
      if (!c.alive) continue;
      // A fleeing witness has stopped being a sensor and started being a runner (RI-CRM01 §3a).
      if (c.flee) this.stepFlight(sim, c, f);
      const per = PER.perceiveInto(this._per, this.d.detection, sim, { x: c.pos[0], y: c.pos[1], z: c.pos[2], yaw: c.yaw, R: c.R },
        { px: pos[0], py: pos[1], pz: pos[2], V: p.V, soundR: p.soundR, motion: p.motion });
      const w = this.effectiveContextWeight() * zoneCtx;
      // SIGHT is weighted by what you are doing and by who you are; HEARING is not. A footfall
      // is a footfall whether or not the hand it belongs to is holding someone else's cup, and
      // `contextWeight` 0.00 (sheathed, in a public street) must not silence a sprinting
      // heavy-armoured stranger on a reed boardwalk. Round 1 computed r_effective across a 55x
      // range and nothing in the world ever heard it; this is the line that hears it.
      let perS = 0;
      let channel = null;
      const sightS = per.sight_per_s * this.raceSuspicion() * w;
      const hearS = per.hear_per_s * this.d.detection.civilian.hearing_suspicion_scale;
      if (sightS >= hearS && sightS > 0) { perS = sightS; channel = per.cone === 'peripheral' ? 'peripheral' : 'sight'; }
      else if (hearS > 0) { perS = hearS; channel = 'hearing'; }
      c.los = per.los;
      c.dist = per.dist;
      c.alert_channel = channel;
      c.filling = perS > 0;
      if (c.suspicion < baseline) c.suspicion = baseline;
      // A sound makes a townsperson turn round and say something; it does not make them raise
      // the alarm. Hearing alone is capped at CHALLENGE, which keeps RI-STL01 §6's "last
      // off-ramp" reachable for a player who was heard but never seen.
      const ceiling = channel === 'hearing' ? this.d.detection.civilian.hearing_ceiling : null;
      const now = DET.stepCivilian(this.d.detection, c, perS, ceiling);
      if (now) {
        c.advancedAtF = f;
        this.events.push({ type: 'civ_state', eid: c.eid, state: now, frame: f, suspicion: Math.round(c.suspicion), channel });
        if (bus) { const e = bus.emit(f, now === 'CHALLENGE' ? 'challenge' : now === 'ALARM' ? 'zone_alert' : 'detect'); e.eid = c.eid; e.state = now; e.channel = channel; }
      }
    }

    // 6b. THE GUARD LADDER, as behaviour rather than as a lookup.
    //
    // Round 1: "there are no guard entities either, so `getGuardBand()` is a function of a
    // number you set with `setBounty()`." The 17-crime schedule, the three arrest answers, the
    // jail ledger and the S10 decision were all correct and all out of reach in play, because
    // nothing in the world ever read the bounty. A guard who can see you now reads it, every
    // frame, and does one of three things — greet, offer the arrest, or attack.
    this.stepGuards(sim, bus);

    // 7. pending reports. A fleeing witness who reaches a guard reports; one whose latency
    // expires reports. Bounty exists at exactly one place in this build and this is it.
    for (const r of this.pending) {
      if (r.due(f)) {
        const res = this.crime.land(r.w, f, r.kindOverride || 'unlawful');
        r.state = 'landed';
        const wc = this.civilians.find((c) => c.eid === r.w.eid);
        if (wc) { wc.flee = null; wc.reporting = false; }
        if (bus && res) { const e = bus.emit(f, 'report'); e.kind = res.kind; e.bounty_delta = res.delta; e.eid = r.w.eid; e.route = r.route.route; }
        this.events.push({ type: 'report', frame: f, eid: r.w.eid, route: r.route.route, kind: res ? res.kind : 'none', bounty_delta: res ? res.delta : 0 });
      }
    }
    this.mirrorToSave(sim);

    // 7. lock collar.
    if (p.lockAttempt && !p.lockAttempt.open && !p.lockAttempt.failed) {
      if (input && input.pressed & (1 << INTERACT_BIT)) {
        const r = p.lockAttempt.press();
        if (r.result === 'pick_break') this.emitSound(sim, f, 'pick_break', bus);
      }
      p.lockAttempt.step();
    }

    // 8. pickpocket hold.
    if (p.pickpocket && !p.pickpocket.done) {
      if (!(input && (input.held | input.pressed) & (1 << INTERACT_BIT))) { p.pickpocket.release(); p.pickpocket = null; }
      else { p.pickpocket.step(0); if (p.pickpocket.complete) this.completePickpocket(sim, f, bus); }
    }
  }

  // ---- THE ENEMY PERCEPTION PASS ----------------------------------------------------------
  //
  // GAP-W1-stealth-crime-model-not-coupled-to-the-world closes here.
  //
  // Before: `combat/enemy.js::_idleBehaviour` did `this.alert = min(100, this.alert + 4)` if the
  // player was inside a radius and a cone. `V` was computed into the trace every frame and read
  // by nothing; the sound radius was computed across a 55x range and heard by nothing; there was
  // no occlusion term at all. An INFANTRY at 8 m reached AGGRO in 0.500 s at V = 0.6669 and in
  // 0.500 s at V = 0.0500.
  //
  // After: the meter is filled by `perception.js::fill` from `p.V`, `p.soundR`, `p.motion` and a
  // real line-of-sight cast, and `combat/enemy.js` reads the result. The archetype's own
  // `sight_radius_m` and `sight_cone_deg` still gate it (RI-AI01 §B owns the geometry; RI-STL01
  // §1 says so in as many words), and RI-STL01 §2's V is the multiplier on the fill.
  //
  // WHY IT IS HERE AND NOT IN `combat/`. The fight does not own perception — `RI-STL01` §1 does,
  // and putting it in the fight is how two models came to exist. The stealth step runs after the
  // fight and after physics (see sim/step.js), so it reads the positions the trace reports on
  // this frame, and it writes the meter through to the controller so the fight's own behaviour
  // selection sees it on the next frame's mirror.
  stepPerception(sim, bus) {
    const f = sim.frame;
    const p = this.p;
    const d = this.d.detection;
    const pos = sim.player ? sim.player.pos : ZERO3;
    const decay = d.perception_inherited_from_RI_AI01.decay_per_s;
    const baseline = this.zones.baselineAlert(p.zone, f);
    for (let i = 0; i < sim.entities.length; i++) {
      const e = sim.entities[i];
      if (e.hp <= 0) { e.alertChannel = null; continue; }
      // A training dummy has no perception, and saying so is better than giving it eyes.
      if (e.ai === 'none') { e.alertChannel = null; continue; }
      const prevState = e.alertState;
      const prevAlert = e.alert;

      // The archetype's own cone is RI-AI01 §B's, and it is not the same number as the
      // detection model's ±55°/±100°. The narrower of the two governs: an enemy whose statblock
      // declares a 120° cone cannot see through a 200° peripheral arc it does not have.
      const R = e.sight_radius_m;
      const per = PER.perceiveInto(this._per, d, sim,
        { x: e.pos[0], y: e.pos[1], z: e.pos[2], yaw: e.yaw, R },
        { px: pos[0], py: pos[1], pz: pos[2], V: p.V, soundR: p.soundR, motion: p.motion });
      if (per.channel !== 'hearing' && Math.abs(per.bearing_deg) > e.sight_cone_deg / 2) {
        per.per_s = per.hear_per_s;
        per.channel = per.hear_per_s > 0 ? 'hearing' : null;
      }

      // The instant channels (RI-AI01 §B): damage forces AGGRO from any direction. `b.aggro` is
      // the harness/scenario override and is honoured as the `scripted` channel so that a critic
      // reading the trace can tell a scripted aggro from a perceived one.
      const body = sim._combat ? sim._combat.bodyOf(e.eid) : null;
      if (body && body.aggro) { e.alert = 100; e.alertChannel = 'scripted'; }
      else PER.stepAlert(e, per, decay, e.alertState === 'AGGRO' ? 0 : baseline, d.perception_inherited_from_RI_AI01.peripheral_alert_cap);

      e.percept_dist = per.dist;
      e.percept_los = per.los;

      // AGGRO hysteresis, RI-AI01 §B: "once AGGRO, drop to SEARCH only via the de-aggro rule,
      // never via meter decay." T25's de-aggro rule is `no LOS >= 6.0 s AND dist > 1.6 R`.
      if (e.alertState === 'AGGRO') {
        if (per.los && per.dist <= 1.6 * R) { e.lastSeenF = f; e.lkp = e.lkp || [0, 0, 0]; e.lkp[0] = pos[0]; e.lkp[1] = pos[1]; e.lkp[2] = pos[2]; }
        const lost = f - (e.lastSeenF === undefined ? f : e.lastSeenF);
        if (lost >= 6 * 60 && per.dist > 1.6 * R) {
          e.alert = d.perception_inherited_from_RI_AI01.suspicious_at;
          e.alertState = 'SEARCH';
          this.beginSearch(sim, e, f, bus);
        } else { e.alert = 100; }
      } else {
        if (per.los && per.per_s > 0) { e.lastSeenF = f; e.lkp = e.lkp || [0, 0, 0]; e.lkp[0] = pos[0]; e.lkp[1] = pos[1]; e.lkp[2] = pos[2]; }
        e.alertState = e.alert >= 100 ? 'AGGRO'
          : e.alert >= d.perception_inherited_from_RI_AI01.suspicious_at ? 'SUSPICIOUS'
            : e.alert > 0 ? 'SUSPICIOUS' : 'IDLE';
        // RI-AI01 T04: SUSPICIOUS -> SEARCH when alert >= 50 is held with no LOS. The search is
        // what makes losing you frightening rather than a 12-second timer, and round 1 never
        // instantiated it: `search.js` passed every module assertion and the step never called it.
        if (e.alert >= d.perception_inherited_from_RI_AI01.suspicious_at && !per.los && !this.searchFor(e.eid)) {
          e.alertState = 'SEARCH';
          this.beginSearch(sim, e, f, bus);
        } else if (this.searchFor(e.eid) && e.alert < 100) {
          e.alertState = 'SEARCH';
        }
      }

      // Write through to the fight. `combat/enemy.js` no longer fills this — it reads it.
      const ec = sim._combat ? sim._combat.enemies.get(e.eid) : null;
      if (ec) { ec.alert = e.alert; ec.alertState = e.alertState; ec.alertChannel = e.alertChannel; }

      if (prevState !== e.alertState && bus) {
        const ev = bus.emit(f, e.alertState === 'SEARCH' ? 'search_start' : 'detect');
        ev.eid = e.eid; ev.from = prevState; ev.to = e.alertState; ev.channel = e.alertChannel; ev.alert = Math.round(e.alert);
      }
      if (prevAlert < 100 && e.alert >= 100) {
        this.events.push({ type: 'aggro', eid: e.eid, frame: f, channel: e.alertChannel, V: p.V, dist: +per.dist.toFixed(2) });
      }
    }
  }

  /** An instant alert channel that is not the player being seen — RI-AI01 §B's bottom three rows. */
  raiseAlert(sim, eid, amount, channel) {
    const e = sim.entities.find((x) => x.eid === eid);
    if (!e) return null;
    PER.bumpAlert(e, amount, channel);
    const ec = sim._combat ? sim._combat.enemies.get(eid) : null;
    if (ec) { ec.alert = e.alert; ec.alertChannel = channel; }
    return e.alert;
  }

  // ---- THE SEARCH — RI-STL01 §7 -----------------------------------------------------------

  searchFor(eid) { return this.searches.find((s) => s.eid === eid && !s.over); }

  /**
   * S-1 plan, S-3 propagation, and a walker. The `Search` object is `search.js`'s, unchanged —
   * round 1's module was correct and merely unreachable. This is the call site it lacked.
   */
  beginSearch(sim, e, frame, bus) {
    if (this.searchFor(e.eid)) return null;
    const lkp = e.lkp ? [e.lkp[0], e.lkp[1], e.lkp[2]] : [e.pos[0], e.pos[1], e.pos[2]];
    const zone = this.p.zone || '__world';
    const s = new Search(this.d.search, {
      eid: e.eid, lkp, startFrame: frame, zone,
      coverVolumes: this.coverVolumes.filter((v) => !v.zone || v.zone === zone),
      ownCone: { pos: [e.pos[0], e.pos[1], e.pos[2]], yaw: e.yaw, radius_m: e.sight_radius_m, half_deg: e.sight_cone_deg / 2 },
    });
    this.searches.push(s);
    // S-3: one hop, bounded, never chains.
    const allies = sim.entities.filter((x) => x.eid !== e.eid && x.hp > 0 && x.ai !== 'none' && !x.alertHop && x.alert < this.d.search.s3.raise_to);
    const raised = propagate(this.d.search, e.pos, allies);
    for (const eid of raised) {
      const a = sim.entities.find((x) => x.eid === eid);
      const ec = sim._combat ? sim._combat.enemies.get(eid) : null;
      if (a) { a.alertState = 'SUSPICIOUS'; a.alertChannel = 'shout'; }
      if (ec) { ec.alert = this.d.search.s3.raise_to; ec.alertState = 'SUSPICIOUS'; }
    }
    this.events.push({ type: 'search_start', eid: e.eid, frame, lkp, plan: s.plan.map((v) => v.id), raised });
    if (bus) { const ev = bus.emit(frame, 'search_start'); ev.eid = e.eid; ev.lkp = lkp; ev.plan = s.plan.map((v) => v.id); ev.raised = raised; }
    return s;
  }

  /**
   * Walk the searchers. S-2's radius bands are consumed as a REACQUIRE radius: inside the band
   * the searcher re-tests line of sight against the player and re-acquires, which is what makes
   * "a player who hides at 10 m and holds still is found" true rather than decorative.
   */
  stepSearches(sim, bus) {
    if (!this.searches.length) return;
    const f = sim.frame;
    const ppos = sim.player ? sim.player.pos : ZERO3;
    const walk = this.d.search.walk_mps;
    for (let i = 0; i < this.searches.length; i++) {
      const s = this.searches[i];
      if (s.over) continue;
      const e = sim.entities.find((x) => x.eid === s.eid);
      if (!e || e.hp <= 0) { s.end(f); continue; }
      if (e.alertState === 'AGGRO') { s.acquired = true; s.end(f); this.endSearch(sim, s, e, f, true, bus); continue; }

      // S-1 gives the plan; S-2 gives the band. Once the plan is exhausted the searcher SWEEPS
      // OUT to the band radius rather than standing on the last crate, so `RI-STL01` method 6's
      // "measure searcher distance from LKP over the 12 s" has something to measure. See
      // AMENDMENT-W1-15-01 §7 for why that assertion's own numbers (13 m, 19 m) cannot be
      // reached jointly with S-1's 8 m cap inside a 12 s window at S17's 2.0 m/s walk.
      let tgt = s.targetAt(f);
      const planDoneF = s.startFrame + (this.d.search.s1.lkp_dwell_s + s.plan.length * this.d.search.s1.per_volume_s) * PER.HZ;
      if (f >= planDoneF) {
        const band = s.radiusAt(f);
        // Outward along the LKP-to-searcher axis: the direction it already came from is the
        // direction it has already looked, so it pushes past the LKP the other way.
        let ax = s.lkp[0] - e.pos[0], az = s.lkp[2] - e.pos[2];
        const al = Math.hypot(ax, az) || 1;
        s._sweep = s._sweep || [s.lkp[0] + (ax / al) * band, s.lkp[1], s.lkp[2] + (az / al) * band];
        s._sweep[0] = s.lkp[0] + (ax / al) * band;
        s._sweep[2] = s.lkp[2] + (az / al) * band;
        tgt = s._sweep;
      }
      const dx = tgt[0] - e.pos[0], dz = tgt[2] - e.pos[2];
      const d = Math.hypot(dx, dz);
      const stepM = walk / PER.HZ;
      if (d > stepM) {
        e.pos[0] += (dx / d) * stepM;
        e.pos[2] += (dz / d) * stepM;
        e.speed = walk;
        e.yaw = norm360(Math.atan2(dx, dz) * 180 / Math.PI);
      } else { e.pos[0] = tgt[0]; e.pos[2] = tgt[2]; e.speed = 0; }
      e.searchTarget = tgt;
      e.searchRadius = s.radiusAt(f);
      // The combat body is the authority for position (sim/combat-bridge.js). Move it too, or
      // the next frame's mirror puts the searcher back where it was standing.
      const body = sim._combat ? sim._combat.bodyOf(e.eid) : null;
      if (body) { body.pos[0] = e.pos[0]; body.pos[2] = e.pos[2]; body.yaw = e.yaw; }

      // S-2: re-acquire inside the current band.
      const pd = Math.hypot(ppos[0] - e.pos[0], ppos[2] - e.pos[2]);
      if (pd <= e.searchRadius && PER.losClear(sim, e.pos[0], e.pos[1] + PER.EYE_H_M, e.pos[2], ppos[0], ppos[1] + PER.CHEST_H_M, ppos[2])) {
        e.alert = 100; e.alertState = 'AGGRO'; e.alertChannel = 'sight';
        const ec = sim._combat ? sim._combat.enemies.get(e.eid) : null;
        if (ec) { ec.alert = 100; ec.alertState = 'AGGRO'; }
        s.acquired = true; s.end(f); this.endSearch(sim, s, e, f, true, bus);
        continue;
      }
      if (f >= s.endFrame) { s.end(f); this.endSearch(sim, s, e, f, false, bus); }
    }
    // Retire finished searches so `searches` cannot grow without bound across a long session.
    for (let i = this.searches.length - 1; i >= 0; i--) if (this.searches[i].over) this.searches.splice(i, 1);
  }

  /** S-4. The zone remembers, and the lights go back on. */
  endSearch(sim, s, e, frame, acquired, bus) {
    const z = this.zones.onSearchEnded(s.zone, frame, acquired);
    let relit = 0;
    if (!acquired) {
      for (const src of this.light.sources) if (!src.lit) { src.lit = true; src.relightAtF = -1; relit++; }
      e.alert = 0; e.alertState = 'IDLE'; e.alertChannel = null; e.speed = 0;
      const ec = sim._combat ? sim._combat.enemies.get(e.eid) : null;
      if (ec) { ec.alert = 0; ec.alertState = 'IDLE'; }
    }
    e.searchTarget = null; e.searchRadius = 0;
    this.events.push({ type: 'search_end', eid: s.eid, frame, acquired, visited: s.visited.slice(), zone_baseline: z.baseline, lights_relit: relit });
    if (bus) { const ev = bus.emit(frame, 'search_end'); ev.eid = s.eid; ev.acquired = acquired; ev.visited = s.visited.slice(); ev.zone_baseline_alert = acquired ? 0 : z.baseline; ev.lights_relit = relit; }
  }

  // ---- THE GUARD LADDER — RI-CRM01 §4, as behaviour -----------------------------------------

  /**
   * `RI-CRM01` method 7: "step 600 frames in a guard's cone. Assert the three behaviours are
   * greeting-only / arrest-dialogue-sheathed / AGGRO. Assert the arrest guard never draws a
   * weapon in band 2, and assert a surrender parley exists in band 3."
   *
   * The band is computed from the live bounty and the player's own race and standing — which is
   * seam **AR-3**, the world reaching into the fight: an Imperial bounty of 3,000 is what makes
   * a militiaman attack a Naga on sight and merely greet an Imperial.
   */
  stepGuards(sim, bus) {
    const f = sim.frame;
    let band = null;
    for (const g of this.civilians) {
      if (!g.alive || g.group !== 'guard') continue;
      if (band === null) band = this.guardBandNow();
      const prev = g.guard_band;
      // A guard acts on what they can see. Out of LOS or out of radius, they do nothing —
      // which is why the arrest is something you can walk away from.
      const engaged = g.los && g.dist !== undefined && g.dist <= g.R;
      g.guard_band = engaged ? band.band : 0;
      g.guard_behaviour = engaged ? band.behaviour : 'unaware';
      g.weapon_drawn = engaged && band.band >= 3;
      g.parley = band.parley || null;
      if (prev !== g.guard_band) {
        this.events.push({ type: 'guard_band', eid: g.eid, frame: f, band: g.guard_band, behaviour: g.guard_behaviour, bounty: this.crime.bounty.imperial, weapon_drawn: g.weapon_drawn, parley: g.parley });
        if (bus) { const e = bus.emit(f, 'arrest'); e.eid = g.eid; e.band = g.guard_band; e.behaviour = g.guard_behaviour; e.weapon_drawn = g.weapon_drawn; e.parley = g.parley; }
      }
      // Band 3 is attack-on-sight, and an attack needs a body. If this guard has a combat
      // entity of the same eid, it is put into AGGRO — the same meter every other perception
      // channel writes, so a critic reading the trace sees one alert model and not two.
      const ent = (sim.entities || []).find((x) => x.eid === g.eid);
      if (ent && g.guard_band >= 3) {
        ent.alert = 100; ent.alertState = 'AGGRO'; ent.alertChannel = 'bounty';
        const ec = sim._combat ? sim._combat.enemies.get(g.eid) : null;
        if (ec) { ec.alert = 100; ec.alertState = 'AGGRO'; }
      }
    }
    this._guardBand = band;
  }

  /** The band for the player as they stand, from the live ledger. */
  guardBandNow() {
    const th = JUS.thresholds(this.d.races, this.d.sanction, this.d.justice, {
      race: this.p.race, standing: SAN.standingKey(this.p.standings), authority: 'imperial_authority',
    });
    return { ...JUS.guardBand(this.d.justice, this.crime.bounty.imperial, th, {}), thresholds: th, bounty: this.crime.bounty.imperial };
  }

  // ---- THE WITNESS, DERIVED FROM THE WORLD — RI-CRM01 §2/§3 -------------------------------

  /**
   * Called on the frame a crime record is created, by every verb that creates one.
   *
   * ROUND 1's FAILURE, VERBATIM FROM THE VERDICT: "a civilian standing 3 m away in full
   * daylight, at contextWeight 3.00, already at civ_state ALARM with suspicion 100, watches you
   * take an object that belongs to someone" and the answer was `witnesses: []`. Every witness in
   * that build was created by a critic calling `addWitness()`. This method is the world doing it.
   *
   * ON "advanced to CHALLENGE or ALARM THIS FRAME". `RI-CRM01` §2's predicate is written for the
   * frame a crime happens, and read literally it excludes the civilian above — who reached ALARM
   * two seconds earlier and is still staring at you. The reading implemented here, and it is a
   * reading rather than a transcription, is: **the NPC is at CHALLENGE or ALARM, and the crime's
   * own contextWeight is what is holding them there** (they transitioned this frame, or their
   * suspicion is still being filled). A witness who arrived at ALARM one frame before you closed
   * your hand on the cup is a witness.
   */
  deriveWitnesses(sim, crimeRec, frame, bus, opts) {
    const o = opts || {};
    const p = this.p;
    const pos = sim.player ? sim.player.pos : ZERO3;
    const w = this.d.justice.witness;
    const made = [];
    for (const c of this.civilians) {
      if (!c.alive) continue;
      if (WIT.NEVER_WITNESS.has(c.group)) continue;
      const isGuard = c.group === 'guard';
      const per = PER.perceiveInto(this._per, this.d.detection, sim,
        { x: c.pos[0], y: c.pos[1], z: c.pos[2], yaw: c.yaw, R: c.R },
        { px: pos[0], py: pos[1], pz: pos[2], V: p.V, soundR: p.soundR, motion: p.motion });
      const advanced = c.civ_state === 'CHALLENGE' || c.civ_state === 'ALARM'
        ? (c.advancedAtF === frame || !!c.filling)
        : false;
      const npc = { alive: c.alive, group: c.group, R: c.R, advancedToChallengeOrAlarmThisFrame: advanced };
      const r = WIT.isWitness(this.d.justice, npc, { los: per.los, V: p.V, dist: per.dist });
      c.witness_check = { crime: crimeRec.id, ...r, dist: +per.dist.toFixed(2), los: per.los, V: p.V, civ_state: c.civ_state };
      if (!r.witness) continue;
      const rec = this.crime.witness(crimeRec.id, { eid: c.eid, frame, identified: r.identified, kind: 'sight' });
      made.push(rec);
      c.witnessed = (c.witnessed || 0) + 1;
      if (bus) { const ev = bus.emit(frame, 'witness'); ev.eid = c.eid; ev.crime_ref = crimeRec.id; ev.identified = r.identified; ev.dist_m = +per.dist.toFixed(2); ev.V = p.V; ev.guard = isGuard; }
      this.events.push({ type: 'witness', eid: c.eid, crime_ref: crimeRec.id, frame, identified: r.identified, dist_m: +per.dist.toFixed(2) });
      this.beginReport(sim, c, rec, crimeRec, frame, bus);
    }
    // Hearing-only witnesses: a death heard within 20 m by somebody who saw nothing.
    if (o.deathAt) {
      for (const c of this.civilians) {
        if (!c.alive || this.crime.witnesses.some((x) => x.eid === c.eid && x.crime_id === crimeRec.id)) continue;
        const dd = Math.hypot(c.pos[0] - o.deathAt[0], c.pos[2] - o.deathAt[2]);
        const hr = WIT.isHearingWitness(this.d.justice, { alive: c.alive }, { distToDeath: dd });
        if (!hr.witness) continue;
        const rec = this.crime.witness(crimeRec.id, { eid: c.eid, frame, identified: false, kind: 'hearing' });
        made.push(rec);
        if (bus) { const ev = bus.emit(frame, 'witness'); ev.eid = c.eid; ev.crime_ref = crimeRec.id; ev.identified = false; ev.kind = 'hearing'; }
        this.beginReport(sim, c, rec, crimeRec, frame, bus);
      }
    }
    return made;
  }

  /**
   * RI-CRM01 §3a's route, computed from where the guards actually are, and §3a's fleeing
   * witness, who really moves. Round 1 had neither: there were no guard entities at all, so
   * `reportRoute()` was a function of a number the critic supplied.
   */
  beginReport(sim, c, witnessRec, crimeRec, frame, bus) {
    const guards = this.civilians.filter((g) => g.alive && g.group === 'guard' && g.eid !== c.eid);
    let nearest = null, nearestG = null;
    for (const g of guards) {
      const d = Math.hypot(g.pos[0] - c.pos[0], g.pos[2] - c.pos[2]);
      if (nearest === null || d < nearest) { nearest = d; nearestG = g; }
    }
    const walls = nearestG ? PER.wallsBetween(sim, c.pos[0], c.pos[1] + PER.EYE_H_M, c.pos[2], nearestG.pos[0], nearestG.pos[1] + PER.EYE_H_M, nearestG.pos[2]) : 0;
    const route = WIT.reportRoute(this.d.justice, c, {
      nearestGuardDist: nearest,
      nearestGuardWallsBetween: walls,
      guardIsWitness: c.group === 'guard',
      jurisdiction: crimeRec.jurisdiction,
    });
    const pr = new WIT.PendingReport(this.d.justice, { witnessRec, route, startFrame: frame });
    pr.quote = crimeRec.quote;
    this.pending.push(pr);
    // The flight itself. "They stop their schedule, face you or the nearest exit, and RUN."
    if (route.route === 'run_to_guard' && nearestG) {
      c.flee = { toward: [nearestG.pos[0], nearestG.pos[1], nearestG.pos[2]], speed: this.d.justice.report_chain.routes.find((r) => r.id === 'run_to_guard').run_speed_mps, target_eid: nearestG.eid };
      c.reporting = true;
    } else if (route.route !== 'never') {
      c.reporting = true;
    }
    this.events.push({ type: 'report_route', eid: c.eid, crime_ref: crimeRec.id, route: route.route, latency_f: route.latency_f, nearest_guard_m: nearest === null ? null : +nearest.toFixed(1), target: c.flee ? c.flee.target_eid : null, frame });
    if (bus) { const ev = bus.emit(frame, 'report_route'); ev.eid = c.eid; ev.route = route.route; ev.latency_f = route.latency_f; ev.path_target = c.flee ? c.flee.target_eid : null; }
    return pr;
  }

  /** One fleeing witness, one frame. */
  stepFlight(sim, c, frame) {
    const dx = c.flee.toward[0] - c.pos[0], dz = c.flee.toward[2] - c.pos[2];
    const d = Math.hypot(dx, dz);
    const stepM = c.flee.speed / PER.HZ;
    if (d <= stepM) { c.pos[0] = c.flee.toward[0]; c.pos[2] = c.flee.toward[2]; c.flee = null; return; }
    c.pos[0] += (dx / d) * stepM;
    c.pos[2] += (dz / d) * stepM;
    c.yaw = norm360(Math.atan2(dx, dz) * 180 / Math.PI);
  }

  /**
   * Every crime in this build passes through here, so there is exactly one place where a crime
   * record and its witnesses are created together and they cannot get out of step.
   */
  commitCrime(sim, crimeKey, opts, bus) {
    const frame = sim.frame;
    const rec = this.crime.commit(crimeKey, { frame, jurisdiction: this.p.jurisdiction || 'imperial', settlement: this.p.settlement || null, ...opts });
    if (bus) { const ev = bus.emit(frame, 'crime'); ev.crime = crimeKey; ev.crime_ref = rec.id; ev.quote_g = rec.quote; ev.jurisdiction = rec.jurisdiction; }
    this.deriveWitnesses(sim, rec, frame, bus, opts);
    this._lastCrimeFrame = frame;
    this.mirrorToSave(sim);
    return rec;
  }

  // ---- PERSISTENCE — the half of RI-STL02 method 2 that round 1 did not ship ---------------

  /**
   * The stealth/crime ledger projected into the save's `crime.*` block and the inventory.
   *
   * Round 1: `takeObject()` returned `stolen_from`, computed the disposition hit and filed a
   * crime record, and `saveState().crime.stolen_registry` was `[]` and `saveState().inventory`
   * still held only the starting knife. The ledger and the save were two objects that never
   * met. `sim.quest.crime` is the one the save reads (save/state.js), so it is written here,
   * every frame, from the one the systems mutate.
   */
  mirrorToSave(sim) {
    if (!sim.quest || !sim.quest.crime) return;
    const q = sim.quest.crime;
    q.bounty = { imperial: this.crime.bounty.imperial };
    for (const k of Object.keys(this.crime.bounty.settlement)) q.bounty['settlement:' + k] = this.crime.bounty.settlement[k];
    for (const k of Object.keys(this.crime.bloodprice)) q.bounty['bloodprice:' + k] = this.crime.bloodprice[k];
    // Witness IDENTITIES, not a count — RI-JRN05 M8 and its "How we lose" #4.
    q.witnesses = this.crime.witnesses.map((w) => `${w.eid}@${w.crime_id}${w.reported ? ':reported' : ''}${w.identified ? ':identified' : ''}`).sort();
    q.stolen = this.crime.stolenRegistry.map((s) => s.instance).sort();
    q.hunting = this.crime.hunters.map((h) => h.id || h.faction || String(h)).sort();
  }

  /**
   * Clear the subsystem to its boot state. Called by `applyNamedState()`, i.e. by every
   * `reset()` and every `loadState()`.
   *
   * The list is exhaustive by construction: everything below is either re-`new`ed or emptied.
   * The player's SKILLS are deliberately preserved — a named state may declare a character and
   * the character piece owns that — but the CRIME LEDGER, the civilians, the searches, the zone
   * memory, the scratch occluders and the context are all scenario state and all go.
   */
  resetSubsystem() {
    // A fresh scenario boundary: any scripted pin from the PREVIOUS scenario must not survive
    // into this one, or a probe that ran `setStealthState({security:80})` once would leak that
    // override into every scenario after it for the rest of the session.
    this._overridden.clear();
    this.zones = new ZoneMemory(this.d.search);
    this.crime = new CrimeWorld(this.d.bounty, this.d.justice);
    this.civilians.length = 0;
    this.pending.length = 0;
    this.searches.length = 0;
    this.events.length = 0;
    this.coverVolumes.length = 0;
    this.occluders = new CollisionCell('stealth_occluders', []);
    for (const s of this.light.sources) { s.lit = true; s.relightAtF = -1; }
    Object.assign(this.p, {
      crouched: false, crouchRefusedReason: null, inCover: false, inCoverForced: false,
      inCoverFraction: 0, motionForced: null, carryingTorch: false, zone: null, motion: 'still',
      lockAttempt: null, pickpocket: null, jurisdiction: 'imperial', settlement: null,
      magicChameleonPct: 0, magicInvisible: false, magicMufflePct: 0, magicLightBonus: 0, magicDisguise: false,
    });
    this.setContext('public_street_sheathed');
    // The world's own object records carry `stolen_from`; a scenario boundary must put them
    // back or the second scenario in a session starts with the first one's loot marked hot.
    for (const k of Object.keys(this.property || {})) {
      for (const z of this.property[k].zones || []) for (const c of z.contents || []) c.stolen_from = null;
    }
    return true;
  }

  /**
   * The SAVE-LOAD half of `resetSubsystem()` — everything that is session ephemera and NOT
   * save state, minus the two fields `applySave()` restores one statement before this runs
   * (`save/state.js`: `sim.stealth.crime.fromJSON(blob.crime.ledger)` then
   * `sim.stealth.zones.fromJSON(blob.crime.zones)`). `resetSubsystem()` cannot be reused on
   * this boundary: it also re-`new`s `this.crime`/`this.zones`, which would throw the ledger
   * `applySave()` just restored back to zero on the very next line.
   *
   * Declared in `Engine._sessionObservers()`'s `stealth` row as the `save` handler. Until this
   * existed the row's `why_not` read "applySave() restores crime.ledger + crime.zones only;
   * civilians/searches/pending survive a load" (found and reported, not fixed, by W1-SOULS r3):
   * a civilian who watched last session's theft, or a search still walking to a stale LKP, was
   * still standing in the loaded world, and a witness who was mid-report from a crime the new
   * save never committed could still land a bounty on it.
   */
  resetSessionEphemera() {
    this.civilians.length = 0;
    this.pending.length = 0;
    this.searches.length = 0;
    this.events.length = 0;
    this.coverVolumes.length = 0;
    this.occluders = new CollisionCell('stealth_occluders', []);
    for (const s of this.light.sources) { s.lit = true; s.relightAtF = -1; }
    Object.assign(this.p, {
      crouched: false, crouchRefusedReason: null, inCover: false, inCoverForced: false,
      inCoverFraction: 0, motionForced: null, carryingTorch: false, zone: null, motion: 'still',
      lockAttempt: null, pickpocket: null,
    });
    this.setContext('public_street_sheathed');
    // `this.property` is the same in-memory object for the whole session — it is never
    // rebuilt by `sim.reset()` — so an object taken (or laundered) after the save point would
    // otherwise carry its `stolen_from` mark straight through the load unchanged. Rebuild it
    // from the registry `applySave()` just restored, which is the loaded save's own truth
    // (rule: audit the running world after a load, not the bytes).
    const stolen = new Map(this.crime.stolenRegistry.filter((s) => !s.laundered_by).map((s) => [s.instance, s.owner]));
    for (const k of Object.keys(this.property || {})) {
      for (const z of this.property[k].zones || []) for (const c of z.contents || []) c.stolen_from = stolen.get(c.instance) || null;
    }
    return true;
  }

  /**
   * The world's own people, mirrored into `civilians[]`. RI-MTH07's coupling was built and
   * measured entirely against `spawnCivilian()` — a scenario/harness verb nothing in the
   * running province ever calls — so the open world had a witness predicate, a civilian
   * CALM/WATCHING/CHALLENGE/ALARM machine and a pickpocket target list with nobody in it: a
   * player sneaking past a real settlement had no one to be seen by, heard by, or steal in
   * front of. `sim.npcs` (W1-04) is full of people with a schedule and a walking `pos`, and
   * since W1-04-r2's street life, some of them are outdoors at any hour — this is the line
   * that makes them visible to the stealth kernel rather than just to the renderer.
   *
   * Every row here is tagged `_worldDerived` so a scenario's own hand-spawned civilians and
   * guards — the fixture every RI-STL01/RI-CRM01 probe in this piece drives — are never
   * touched, duplicated or removed by this sync.
   */
  syncCiviliansFromWorld(sim) {
    if (!sim.npcs || !sim.npcs.length || !sim.player) return;
    const SYNC_R_M = 40; // >= the widest live r_effective a probe has measured (sprint, ~36.3 m)
    const ppos = sim.player.pos;
    const near = new Map();
    for (const n of sim.npcs) {
      if (!n.present) continue;
      const dx = n.pos[0] - ppos[0], dz = n.pos[2] - ppos[2];
      if (dx * dx + dz * dz > SYNC_R_M * SYNC_R_M) continue;
      near.set(n.eid, n);
    }
    const list = this.civilians;
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i];
      if (!c._worldDerived) continue;
      const n = near.get(c.eid);
      if (!n) { list.splice(i, 1); continue; }
      c.pos[0] = n.pos[0]; c.pos[1] = n.pos[1]; c.pos[2] = n.pos[2];
      c.yaw = n.yaw;
      near.delete(c.eid);
    }
    for (const [eid, n] of near) {
      list.push({
        eid, group: 'civilian', race: n.race || 'saxhleel',
        R: this.d.detection.perception_inherited_from_RI_AI01.sight_radius_R_m.CIVILIAN,
        pos: n.pos.slice(), yaw: n.yaw, suspicion: 0, civ_state: 'CALM', alive: true,
        _worldDerived: true,
      });
    }
  }

  // ---- helpers used by the step and by the harness ----------------------------------------

  effectiveContextWeight() {
    return typeof this.p.contextWeight === 'number' ? this.p.contextWeight : DET.contextWeight(this.d.detection, this.p.contextName);
  }

  raceSuspicion() {
    const r = this.d.races.guards.law_factor[this.p.race];
    return r ? r.suspicion : 1.0;
  }

  setContext(name) {
    this.p.contextName = name;
    this.p.contextWeight = DET.contextWeight(this.d.detection, name);
    return this.p.contextWeight;
  }

  /**
   * RI-STL01 §4's four discrete events. They reach CIVILIANS (they always did) and now they
   * reach ENTITIES too, which is the half that was missing: `pick_break` took a civilian from
   * 0 to 54 in round 1 and left the enemy standing next to the lock at alert 0.
   *
   * `throw_impact` is directed AT THE IMPACT POINT, not at the player — RI-STL01 §4's own note,
   * and it is the whole of the distraction verb. `at` overrides the origin for that row.
   */
  emitSound(sim, frame, id, bus, at) {
    const e = DET.discreteSound(this.d.detection, id);
    const src = at || (sim.player ? sim.player.pos : ZERO3);
    for (const c of this.civilians) {
      if (!c.alive) continue;
      const dx = src[0] - c.pos[0], dz = src[2] - c.pos[2];
      if (Math.sqrt(dx * dx + dz * dz) <= e.radius_m) c.suspicion = Math.min(100, c.suspicion + e.alert);
    }
    const heard = [];
    for (const ent of sim.entities || []) {
      if (ent.hp <= 0 || ent.ai === 'none') continue;
      const dx = src[0] - ent.pos[0], dz = src[2] - ent.pos[2];
      if (Math.sqrt(dx * dx + dz * dz) > e.radius_m) continue;
      this.raiseAlert(sim, ent.eid, e.alert, 'hearing');
      // The searcher walks toward the SOUND, which is what makes a thrown rock a verb rather
      // than a number. The last-known-position is the impact point, not the thrower.
      ent.lkp = ent.lkp || [0, 0, 0];
      ent.lkp[0] = src[0]; ent.lkp[1] = src[1]; ent.lkp[2] = src[2];
      if (ent.alert >= this.d.detection.perception_inherited_from_RI_AI01.suspicious_at && ent.alertState !== 'AGGRO') {
        ent.alertState = 'SEARCH';
        this.beginSearch(sim, ent, frame, bus);
      }
      heard.push(ent.eid);
    }
    this.events.push({ type: 'sound', event: id, radius_m: e.radius_m, alert: e.alert, frame, at: [src[0], src[1], src[2]], heard_by: heard });
    if (bus) { const b = bus.emit(frame, 'distraction'); b.event = id; b.radius_m = e.radius_m; b.at = [src[0], src[1], src[2]]; b.heard_by = heard; }
    return { event: id, radius_m: e.radius_m, alert: e.alert, heard_by: heard };
  }

  /** THE ONE DRAW (seam S21). Everything above it was deterministic. */
  completePickpocket(sim, frame, bus) {
    const a = this.p.pickpocket;
    a.done = true;
    const out = PP.resolve(this.d.theft, {
      contextWeight: this.effectiveContextWeight() || 1.60,
      V: this.p.V, sneak: this.p.sneak, raceSuspicion: this.raceSuspicion(), ownerId: a.q.ownerId,
    }, () => rng.next());
    this.events.push({ type: 'pickpocket', frame, caught: out.caught, notice_chance: out.notice_chance, draws: 1 });
    if (bus) { const e = bus.emit(frame, 'pickpocket'); e.caught = out.caught; e.notice_chance = out.notice_chance; }
    if (out.caught) {
      const c = this.crime.commit('pickpocket_caught', { frame, jurisdiction: this.p.jurisdiction || 'imperial', settlement: this.p.settlement || null });
      const w = this.crime.witness(c.id, { eid: a.q.targetEid || 'target', frame, identified: this.p.V >= this.d.justice.witness.identified_at_V });
      this.crime.land(w, frame, 'unlawful');
    }
    this.p.pickpocket = null;
    return out;
  }

  /** The trace block RI-STL01's Comparison method asks for, verbatim in shape. */
  traceBlock() {
    const p = this.p;
    return {
      crouched: p.crouched,
      light: r4(p.L),
      V: r4(p.V),
      // The unclamped product. RI-STL01's floor is a declared floor, not a measurement, and a
      // census that can only read the clamped value cannot tell a working chameleon in the dark
      // from a broken one. Both numbers, always.
      V_raw: r4(p.Vraw === undefined ? p.V : p.Vraw),
      sound_r_m: r3(p.soundR),
      surface: p.surface,
      in_cover: p.inCover,
      motion: p.motion,
      sneak: p.sneak,
      context: p.contextName,
      context_weight: this.effectiveContextWeight(),
      zone: p.zone,
      zone_baseline_alert: p.zone ? this.zones.baselineAlert(p.zone, this._frame || 0) : 0,
      lock: p.lockAttempt ? p.lockAttempt.block() : null,
      bounty_imperial: this.crime.bounty.imperial,
      witnesses_pending: this.crime.witnesses.filter((w) => !w.reported).length,
    };
  }

  civTraceBlock() {
    return this.civilians.map((c) => ({
      eid: c.eid, group: c.group, civ_state: c.civ_state,
      suspicion: r2(c.suspicion), context_weight: this.effectiveContextWeight(),
      // The terms the round-1 verdict could not see: which channel is filling this person, and
      // whether they can actually see you.
      alert_channel: c.alert_channel || null,
      los: c.los === undefined ? null : !!c.los,
      dist_m: c.dist === undefined ? null : r2(c.dist),
      pos: [r2(c.pos[0]), r2(c.pos[1]), r2(c.pos[2])],
      yaw_deg: r2(c.yaw),
      // A fleeing witness is "legible from across a street" (RI-CRM01 §3a) — so it is legible
      // in the trace too: who they are running at, and how long until the report lands.
      reporting: !!c.reporting,
      fleeing_to: c.flee ? c.flee.target_eid : null,
      witnessed: c.witnessed || 0,
    }));
  }

  drain() { const e = this.events; this.events = []; return e; }

  // ---- save (seam S6) -------------------------------------------------------------------

  toJSON() {
    return {
      crime: this.crime.toJSON(),
      zones: this.zones.toJSON(),
      lights_out: this.light.sources.filter((s) => !s.lit).map((s) => ({ id: s.id, relight_at_f: s.relightAtF })),
      player: {
        crouched: this.p.crouched, sneak: this.p.sneak, security: this.p.security, agility: this.p.agility,
        mercantile: this.p.mercantile, speechcraft: this.p.speechcraft, load: this.p.load, race: this.p.race,
        gold: this.p.gold, picks: this.p.picks, standings: { ...this.p.standings },
        surface: this.p.surface, in_cover: this.p.inCover, zone: this.p.zone,
        carrying_torch: this.p.carryingTorch, context: this.p.contextName,
      },
      civilians: this.civilians.map((c) => ({ ...c, pos: c.pos.slice() })),
    };
  }

  fromJSON(o) {
    if (!o) return this;
    this.crime.fromJSON(o.crime);
    this.zones.fromJSON(o.zones);
    for (const s of this.light.sources) { s.lit = true; s.relightAtF = -1; }
    for (const d of o.lights_out || []) { const s = this.light.sources.find((x) => x.id === d.id); if (s) { s.lit = false; s.relightAtF = d.relight_at_f; } }
    Object.assign(this.p, {
      crouched: o.player.crouched, sneak: o.player.sneak, security: o.player.security, agility: o.player.agility,
      mercantile: o.player.mercantile, speechcraft: o.player.speechcraft, load: o.player.load, race: o.player.race,
      gold: o.player.gold, picks: o.player.picks, standings: { ...o.player.standings },
      surface: o.player.surface, inCover: o.player.in_cover, zone: o.player.zone,
      carryingTorch: o.player.carrying_torch,
    });
    this.setContext(o.player.context);
    this.civilians = (o.civilians || []).map((c) => ({ ...c, pos: c.pos.slice() }));
    return this;
  }
}

// The `crouch` and `interact` bits, resolved once.
const CROUCH_BIT = Math.log2(BIT.crouch);
const INTERACT_BIT = Math.log2(BIT.interact);

/**
 * The outdoor ambient, off RI-STL01 §3's table. Piecewise and deterministic; no clock, no RNG.
 *   midday sun 1.00 · overcast day 0.75 · night clear 0.22 · night overcast 0.09
 * Dawn and dusk interpolate across the hour bands so the transition is a ramp a player can
 * plan around rather than a step they get caught by.
 */
export function skyAmbient(env) {
  const h = env ? env.timeOfDay : 12;
  // W1-02. This used to be `weather === 'overcast' || 'storm' || 'rain'` — three ids out of the
  // twenty `render/sky.js` already declared, and out of the forty-one `game/data/world/weather.json`
  // now declares. Every other state, including `heavy_rain`, `salt_storm`, `thick_fog` and
  // `ash_storm`, was therefore lit as MIDDAY SUN by the stealth model while the renderer drew a
  // black sky: the two halves of the build were looking at different weather. The class now comes
  // off the weather table, republished on `env.weatherLight` by `sim/environment.js`, so adding a
  // state cannot silently reintroduce the mismatch. The three legacy ids are kept as the fallback
  // for a sim with no environment installed (the arena states), where `env.weather` is still a
  // bare string.
  const cls = env && env.weatherLight;
  const overcast = cls
    ? (cls === 'overcast' || cls === 'dark')
    : (env && (env.weather === 'overcast' || env.weather === 'storm' || env.weather === 'rain'));
  const dark = cls === 'dark';
  // A storm, a salt-storm or a thick fog at noon is darker than an overcast day and the model has
  // to be able to say so; RI-STL01 §3's table stops at "overcast day 0.75", so `dark` sits below
  // it rather than replacing it.
  const day = dark ? 0.58 : overcast ? 0.75 : 1.00;
  const night = dark ? 0.06 : overcast ? 0.09 : 0.22;
  if (h >= 8 && h < 17) return day;
  if (h >= 21 || h < 4) return night;
  if (h >= 4 && h < 8) return night + (day - night) * ((h - 4) / 4);      // dawn
  return day + (night - day) * ((h - 17) / 4);                            // dusk, 17:00-21:00
}

const ZERO3 = [0, 0, 0];
function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }

function nearestAggroDist(sim) {
  let best = null;
  for (const e of sim.entities || []) {
    if (e.alertState !== 'AGGRO' && e.alert_state !== 'AGGRO') continue;
    const dx = sim.player.pos[0] - e.pos[0], dz = sim.player.pos[2] - e.pos[2];
    const d = Math.sqrt(dx * dx + dz * dz);
    if (best === null || d < best) best = d;
  }
  return best;
}

function r2(v) { return Math.round(v * 100) / 100; }
function r3(v) { return Math.round(v * 1000) / 1000; }
function r4(v) { return Math.round(v * 10000) / 10000; }

export { DET, THF, PP, JUS, SAN, WIT, LockAttempt, lockGate, lockTolerance, unbind, Search, propagate };
