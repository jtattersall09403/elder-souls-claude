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
    };
    this.civilians = [];              // {eid, group, race, R, pos, yaw, suspicion, civ_state, alive}
    this.pending = [];                // PendingReport
    this.searches = [];
    this.events = [];
  }

  // ---- the fixed step -------------------------------------------------------------------

  step(sim, input, bus) {
    const f = sim.frame;
    const p = this.p;

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
    p.motion = spd < 0.05 ? 'still' : p.crouched ? 'crouch_move' : spd > 3.5 ? 'sprint' : 'walk';

    // 3. light at the chest node, then V.
    const pos = sim.player ? sim.player.pos : [0, 0, 0];
    p.L = this.light.withTorch(this.light.sample(pos[0], pos[1] + 1.35, pos[2], p.zone), p.carryingTorch);
    p.V = DET.visibility(this.d.detection, { L: p.L, motion: p.motion, sneak: p.sneak, load: p.load, inCover: p.inCover });
    p.soundR = DET.soundRadius(this.d.detection, { motion: p.motion, sneak: p.sneak, load: p.load, surface: p.surface });

    // 4. relight timers.
    this.light.step(f);

    // 5. civilians. The CALM/WATCHING/CHALLENGE/ALARM machine, never the enemy one.
    const zoneCtx = this.zones.contextMultiplier(p.zone, f);
    const baseline = this.zones.baselineAlert(p.zone, f);
    for (const c of this.civilians) {
      if (!c.alive) continue;
      const dx = pos[0] - c.pos[0], dz = pos[2] - c.pos[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      const bearing = DET.normaliseDeg(Math.atan2(dx, dz) * 180 / Math.PI - c.yaw);
      const cone = DET.coneOf(this.d.detection, bearing);
      const w = this.effectiveContextWeight() * zoneCtx;
      const perS = DET.civSuspicionPerSecond(this.d.detection, {
        V: p.V, dist, R: c.R, cone, raceSuspicion: this.raceSuspicion(), context: w,
      });
      if (c.suspicion < baseline) c.suspicion = baseline;
      const now = DET.stepCivilian(this.d.detection, c, perS);
      if (now) {
        this.events.push({ type: 'civ_state', eid: c.eid, state: now, frame: f, suspicion: Math.round(c.suspicion) });
        if (bus) { const e = bus.emit(f, now === 'CHALLENGE' ? 'challenge' : now === 'ALARM' ? 'zone_alert' : 'detect'); e.eid = c.eid; e.state = now; }
      }
    }

    // 6. pending reports.
    for (const r of this.pending) {
      if (r.due(f)) {
        const res = this.crime.land(r.w, f, r.kindOverride || 'unlawful');
        r.state = 'landed';
        if (bus && res) { const e = bus.emit(f, 'report'); e.kind = res.kind; e.bounty_delta = res.delta; }
      }
    }

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

  emitSound(sim, frame, id, bus) {
    const e = DET.discreteSound(this.d.detection, id);
    for (const c of this.civilians) {
      if (!c.alive) continue;
      const dx = sim.player.pos[0] - c.pos[0], dz = sim.player.pos[2] - c.pos[2];
      if (Math.sqrt(dx * dx + dz * dz) <= e.radius_m) c.suspicion = Math.min(100, c.suspicion + e.alert);
    }
    this.events.push({ type: 'sound', event: id, radius_m: e.radius_m, alert: e.alert, frame });
    if (bus) { const b = bus.emit(frame, 'distraction'); b.event = id; b.radius_m = e.radius_m; }
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
