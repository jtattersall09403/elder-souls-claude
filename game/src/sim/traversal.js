// What the ground and the water do to a body.
//
// WHY THIS FILE EXISTS. Verdict W1-01 round 2 found three holes that between them made the shape
// of the world unmeasurable:
//
//   * "There is no maximum walkable slope. 70.63 deg walked at full stick, +10.28 m in 5 s, state
//     WALK — while the piece's own flood fill calls 40 deg impassable."
//   * "There is no fall. A 150 m drop leaves HP 620->620."
//   * "60 s in 8.28 m of water costs no breath, no stamina and no state change."
//
// Each of those is the same defect: the province produced a NUMBER (a height, a depth, a
// substrate) that nothing downstream was obliged to obey. `engine._settleWorld` snapped the
// player's Y to `field.heightAt()` every frame and applied a horizontal speed multiplier, and that
// was the whole of the coupling between the world and the body. A world you can walk up at any
// angle and fall off with no consequence has no shape.
//
// Everything here is read from `game/data/world/traversal.json`, which is the DECLARATION; this
// module is the OBSERVATION, and `getTraversalReport()` prints both so a critic can diff them
// (HARNESS.md §7 rule 4). Nothing uses a wall clock, a deltaTime or Math.random: every quantity is
// per-frame at 60 Hz, exactly as `sim/player.js` requires.
//
// SEAM DISCIPLINE. S25 is explicit that water "may never change a frame number", so nothing here
// touches a startup, an active window, an i-frame or a stamina COST. What it does is:
//   * retract a displacement (where you ended up),
//   * DENY an action above knee depth rather than degrading it,
//   * charge stamina for being in it,
//   * run a breath clock when your head is under.
// All four are S25 in terms.
'use strict';

const DEG = 180 / Math.PI;
const BANDS = ['W0', 'W1', 'W2', 'W3', 'W4', 'W5'];
const BAND_MIN = { W0: 0.00, W1: 0.01, W2: 0.21, W3: 0.51, W4: 0.96, W5: 1.41 };

/** Band of a depth, with hysteresis about the previous band (RI-WLD10 §1 property 2). */
export function bandWithHysteresis(depth, prev, hyst) {
  let b = 'W0';
  for (const k of BANDS) if (depth >= BAND_MIN[k]) b = k;
  if (!prev || prev === b) return b;
  const pi = BANDS.indexOf(prev), bi = BANDS.indexOf(b);
  // Only the boundary you are leaving is sticky, and only by `hyst`.
  if (bi === pi + 1 && depth < BAND_MIN[b] + hyst) return prev;
  if (bi === pi - 1 && depth > BAND_MIN[prev] - hyst) return prev;
  return b;
}

const bandIndex = (b) => BANDS.indexOf(b);

export class Traversal {
  /**
   * @param {object} cfg game/data/world/traversal.json
   * @param {import('../world/field.js').WorldField} field
   */
  constructor(cfg, field) {
    this.cfg = cfg;
    this.field = field;
    this.sig = null;
    // Everything below is a live counter, reset by `reset()` and saved by the engine.
    this.reset();
  }

  reset() {
    this.airborne = false;
    this.vy = 0;
    this.apexY = null;
    this.band = 'W0';
    this.depth = 0;
    this.submerged = false;
    this.breath = this.cfg.water.breath_max_s;
    // Seam S19's two water effects write these, and this file reads them. Both false for every
    // body that has not been enchanted, so a run with no magic in it behaves exactly as before.
    this.breathesWater = false;
    this.buoyant = false;
    this.mire = 0;
    this.mireLastFootfall = 0;
    this.mired = false;
    this.mireEscapes = 0;
    this.slide = 0;
    this.lastFall = null;
    this.lastLanding = null;
    this.blockedBySlope = false;
    this.footAccum = 0;
    this.mireRecovery = 0;
    this.lastEscapeF = -999;
    this.escapePressed = false;
    this.events = [];
  }

  attach(sig) { this.sig = sig; }

  /** Is an action denied by the water the body is standing in? S25: denied, never degraded. */
  denies(action) {
    const c = this.cfg.water;
    const bi = bandIndex(this.band);
    if (action === 'sprint') return bi > bandIndex(c.sprint_denied_above);
    if (action === 'roll') return bi > bandIndex(c.roll_denied_above);
    if (action === 'attack' || action === 'block' || action === 'parry') return this.band === 'W5';
    return false;
  }

  /**
   * The whole per-frame coupling, run after the step has moved the body and before the frame
   * record is built.
   *
   * @param {object} p        sim.player
   * @param {number} px       the body's x BEFORE this frame's displacement
   * @param {number} pz       the body's z before
   * @param {number} burden   the RI-PRG07 multiplier (1.00 inside a fight, by that item's guard)
   * @param {boolean} moving  did the player request movement this frame
   */
  step(p, px, pz, burden, moving, body) {
    const f = this.field, C = this.cfg;
    // THE AUTHORITY IS THE COMBAT BODY. `sim/combat-bridge.js mirror()` copies hp, stamina and
    // state OUT of `CombatSystem`'s body and INTO `sim.player` at the bottom of every step, which
    // runs before this does — so a drowning tick or a fall's damage written only to `sim.player`
    // is silently reverted one frame later and the world costs nothing. This is exactly the class
    // of defect the round-2 verdict found in the water retraction ("what survived was a constant
    // POSITIONAL LAG ... which is why the whole locomotion ladder read inert"), one field over.
    this.body = body || null;
    this.events.length = 0;
    let x = p.pos[0], z = p.pos[2];
    let dx = x - px, dz = z - pz;

    // ---- 1. the medium ------------------------------------------------------------------------
    const midDepth = f.depthAt(px + dx * 0.5, pz + dz * 0.5);
    this.band = bandWithHysteresis(midDepth, this.band, C.water.hysteresis_m);
    this.depth = midDepth;
    const sub = f.substrateAt(x, z);
    this.substrate = sub;
    const swimming = this.band === 'W5';

    // ---- 2. retraction: water, substrate, burden ----------------------------------------------
    // A retraction can only change where you ended up. It cannot reach a frame number (S25).
    // The substrate is what you are standing ON. While swimming your feet are off the bottom, so
    // the substrate multiplier does not apply and W5 realises exactly RI-WLD10's 1.10 m/s swim.
    const subMult = swimming ? 1 : (C.substrate.speed_mult[sub] || 1);
    const mult = C.water.speed_mult[this.band] * subMult * burden * (this.mired ? 0 : 1);
    if ((dx !== 0 || dz !== 0) && mult !== 1) {
      x = px + dx * mult; z = pz + dz * mult;
      dx = x - px; dz = z - pz;
    }

    // ---- 3. the slope gate --------------------------------------------------------------------
    // You cannot walk up a wall. The number is `slope.max_walkable_deg`, and it is deliberately
    // the SAME 40 deg the province's own S9-NO-FENCES flood fill uses to decide reachability —
    // `tools/world/scale-audit.mjs` now reads it out of the same file rather than retyping it.
    //
    // A BRIDGE AND A ROAD ARE NOT CLIFFS. `slopeAt` samples the ground at +-5 m, and a 6 m carriageway on
    // piers has natural ground 30 m below it 5 m to either side — so the slope gate reads 80
    // degrees in the middle of a flat deck and the slide pushes the walker off its own viaduct.
    // (It did: THE CROSSING stalled at 321 m, on the Stormhold-Helstrom span, before this.) On a
    // deck the structure's own gradient governs, and that is `deck_y` along the segment.
    this.onDeck = f.onDeckAt ? f.onDeckAt(x, z) : null;
    this.onRoad = f.onRoadAt ? f.onRoadAt(x, z) : false;
    this.blockedBySlope = false;
    if (!this.airborne && !swimming && !this.onDeck && !this.onRoad && (dx !== 0 || dz !== 0)) {
      const run = Math.hypot(dx, dz);
      const ux = dx / run, uz = dz / run;
      // THE GATE IS THE SLOPE IN FRONT OF YOU, over a 1.5 m baseline.
      //
      // Three instruments were tried before this one and each failed for a reason worth keeping:
      //   * per-frame rise: at 2 m/s a frame covers 33 mm, so a vertical wall produces a 3 cm rise
      //     and every slope on the province is walkable. That is exactly how round 2 measured
      //     70.63 degrees walked at full stick.
      //   * per-frame rise with a threshold: trips on the sub-2 m step discontinuities where a
      //     settlement pad meets a road corridor. THE CROSSING stopped dead at 321 m on a 0.57 m
      //     kerb.
      //   * omnidirectional `slopeAt(x, z)`: a road on a 2.4 m embankment reads 40 deg+ ACROSS the
      //     carriageway even though it is flat ALONG it, so the road became unwalkable at 502 m.
      // The directional test has none of those failure modes: it is what the body is about to
      // climb, it is smoothed over 1.5 m so a step in the field cannot spike it, and it is exactly
      // the quantity `slope.max_walkable_deg` names.
      const L = 1.5;
      const y0 = f.heightAt(x, z);
      const yA = f.heightAt(x + ux * L, z + uz * L);
      const secantDeg = Math.atan2(yA - y0, L) * DEG;
      // Two readings, and the body is blocked by EITHER. The secant is what is directly in front
      // of it; the local gradient at a 2.5 m baseline catches a face whose secant happens to cross
      // a ledge and read shallow. A 2.5 m baseline is short enough to see a crater rim and long
      // enough not to see a 0.57 m kerb, and the carriageway is exempt above, so it never has to
      // adjudicate a road embankment.
      const localDeg = yA > y0 ? f.slopeAt(x + ux * L * 0.5, z + uz * L * 0.5, 2.5) : 0;
      const climbDeg = Math.max(secantDeg, localDeg);
      if (yA > y0 && climbDeg > C.slope.max_walkable_deg) {
        // Slide along the contour instead of stopping dead, so a steep face guides rather than
        // glues — but no upward progress is made at all.
        const gx = (f.heightAt(x + 1.2, z) - f.heightAt(x - 1.2, z)) / 2.4;
        const gz = (f.heightAt(x, z + 1.2) - f.heightAt(x, z - 1.2)) / 2.4;
        const gl = Math.hypot(gx, gz) || 1;
        const nx = gx / gl, nz = gz / gl;                    // uphill unit vector
        const along = dx * nx + dz * nz;
        x = px + (dx - nx * along); z = pz + (dz - nz * along);
        dx = x - px; dz = z - pz;
        this.blockedBySlope = true;
        this.climbBlockedDeg = +climbDeg.toFixed(2);
        this.events.push({ kind: 'slope_blocked', deg: +climbDeg.toFixed(2) });
      }
    }

    // ---- 4a. the parapet ----------------------------------------------------------------------
    const clamped = f.clampToDeck ? f.clampToDeck(px, pz, x, z) : null;
    if (clamped) { x = clamped[0]; z = clamped[1]; dx = x - px; dz = z - pz; this.onDeck = f.onDeckAt(x, z); }

    // ---- 4. the ONLY-HERE elements are solid --------------------------------------------------
    if (this.sig) {
      const r = this.sig.resolve(x, z, 0.55);
      if (r) { x = r[0]; z = r[1]; dx = x - px; dz = z - pz; }
    }

    p.pos[0] = x; p.pos[2] = z;

    // ---- 5. vertical: gravity, landing, damage ------------------------------------------------
    const ground = f.heightAt(x, z);
    const surf = f.waterSurfaceAt(x, z);
    const groundOrFloat = swimming && surf !== null ? surf - 0.78 * 1.8 : ground;
    if (swimming) {
      // Swimming: the body floats with the waterline at chest, so its Y is the surface minus the
      // submerged fraction of a 1.8 m body. There is no fall while swimming.
      //
      // UNLESS IT CANNOT SWIM. RI-WLD10 §3: `OVERLOADED > 100%` — "cannot swim. You walk the
      // bottom, with a breath clock", and the item cites Hallgerd's Tale for it: "He was drowned
      // in the Sea of Ghosts because he couldn't get his armor off." `burden` arrives here as the
      // RI-PRG07 movement multiplier and is exactly 0 in the IMMOBILE tier, so the sink rule needs
      // no second definition of "overloaded" and cannot drift from the one RI-PRG07 owns.
      this.airborne = false; this.vy = 0; this.apexY = null;
      this.sinking = burden === 0;
      p.pos[1] = this.sinking ? ground : Math.max(ground, groundOrFloat);
    } else if (this.airborne) {
      this.vy -= C.fall.gravity_mps2 / 60;
      p.pos[1] += this.vy / 60;
      if (p.pos[1] <= ground) { this._land(p, ground, x, z); }
    } else if (p.pos[1] > ground + 0.35 && !this.onDeck) {
      // The ground went away under the body — stepping off a viaduct deck, a crater rim, the crown
      // of a petrified bole. Round 2's "it is not a fence because nothing about height costs
      // anything" is closed here.
      this.airborne = true;
      this.vy = 0;
      this.apexY = p.pos[1];
      this.events.push({ kind: 'fall_start', from_y: +p.pos[1].toFixed(2) });
      p.pos[1] += this.vy / 60;
    } else {
      p.pos[1] = ground;
    }
    if (this.airborne && p.pos[1] > (this.apexY ?? p.pos[1])) this.apexY = p.pos[1];

    // ---- 6. sliding ---------------------------------------------------------------------------
    // Above `slide_deg` the body is not supported; it goes downhill whether it was asked to or not.
    if (!this.airborne && !swimming && !this.onDeck && !this.onRoad) {
      const deg = f.slopeAt(x, z, 1.5);
      this.slopeDeg = deg;
      if (deg > C.slope.slide_deg) {
        const gx = (f.heightAt(x + 1.2, z) - f.heightAt(x - 1.2, z)) / 2.4;
        const gz = (f.heightAt(x, z + 1.2) - f.heightAt(x, z - 1.2)) / 2.4;
        const gl = Math.hypot(gx, gz) || 1;
        this.slide = Math.min(C.slope.slide_max_mps, this.slide + C.slope.slide_accel_mps2 / 60);
        p.pos[0] -= (gx / gl) * this.slide / 60;
        p.pos[2] -= (gz / gl) * this.slide / 60;
        p.pos[1] = f.heightAt(p.pos[0], p.pos[2]);
        this._setState(p, 'SLIDE');
      } else this.slide = 0;
    } else this.slopeDeg = f.slopeAt(x, z, 1.5);

    // ---- 7. what the water costs --------------------------------------------------------------
    const W = C.water;
    this.regenSuppressedNow = W.regen_suppressed_in.includes(this.band);
    let drain = (moving && (dx !== 0 || dz !== 0) ? W.stamina_drain_moving_per_s : W.stamina_drain_still_per_s)[this.band] || 0;
    // Seam S19: `buoyancy` holds you up, so the water stops costing you to be in. Not a frame
    // number and not a denial removed — S25 keeps both — just the stamina the band charges.
    if (this.buoyant) drain = 0;
    if (drain > 0) {
      this._spendStamina(p, drain / 60);
      if (W.regen_delay_rearmed_in.includes(this.band)) {
        const until = (p.frameNow || 0) + 42;
        p.regenBlockUntil = Math.max(p.regenBlockUntil, until);
        if (this.body) this.body.regenBlockUntil = Math.max(this.body.regenBlockUntil || 0, until);
      }
    }
    if (this.regenSuppressedNow) {
      // W5: regen suppressed entirely (RI-WLD10 §3). Re-arm the delay every frame so the
      // 42-frame clock can never elapse while swimming.
      const until = (p.frameNow || 0) + 2;
      p.regenBlockUntil = Math.max(p.regenBlockUntil, until);
      if (this.body) this.body.regenBlockUntil = Math.max(this.body.regenBlockUntil || 0, until);
    }
    this.staminaDrainPerS = drain;
    this.regenSuppressed = W.regen_suppressed_in.includes(this.band);

    // ---- 8. breath ----------------------------------------------------------------------------
    // Submerged = the water surface is above the head of a 1.8 m body standing on the bottom.
    const head = p.pos[1] + W.submerge_head_clearance_m;
    this.submerged = surf !== null && surf >= head;
    // Seam S19: `breathe_water` is a real answer to a real drown clock (W1-14 round 3). Wave 1's
    // handler wrote a magic-private `M.water.drownF` that nothing here read, so the spell whose
    // entire purpose is "you do not drown" left you drowning on schedule.
    if (this.submerged && this.breathesWater) {
      this.breath = W.breath_max_s;
    } else if (this.submerged) {
      this.breath = Math.max(0, this.breath - 1 / 60);
      if (this.breath <= 0) {
        const dmg = p.hpMax * (W.drown_hp_pct_per_s / 100) / 60;
        this._damage(p, dmg);
        this.events.push({ kind: 'drowning', hp: +p.hp.toFixed(2) });
        if (p.hp <= 0) { this._setState(p, 'DEATH'); this.events.push({ kind: 'drowned' }); }
      }
    } else if (this.breath < W.breath_max_s) {
      this.breath = Math.min(W.breath_max_s, this.breath + W.breath_refill_mult / 60);
    }

    // ---- 9. substrate: the mire counter -------------------------------------------------------
    const S = C.substrate;
    this.footAccum += Math.hypot(dx, dz);
    // SATURATED SUCK ONLY. RI-WLD10 §4 places `SUCK` at "mudflats at low tide, the Deep Marshes
    // floor, voriplasm margins" and §4's MIRED block ends "drowning := if d rises above 1.40 m
    // while MIRED (a rising tide)" — every context it names is wet mud. Read without that
    // qualifier the rule mires the player after six footfalls (5.4 m) of walking on any cell the
    // substrate raster calls SUCK, including bone-dry ones, which would make roughly a fifth of
    // the province impassable on foot and is not what a mudflat is. The counter therefore runs on
    // SUCK **that has water in it** (band >= W1). This is a deviation from a literal reading of
    // the item and it is declared here rather than hidden: `mire_requires_band` is in
    // traversal.json, and setting it to "W0" restores the literal rule.
    const sucking = sub === 'SUCK'
      && bandIndex(this.band) >= bandIndex(S.mire_requires_band || 'W1');
    if (sucking) {
      if (this.footAccum >= S.mire_footfall_m) {
        this.footAccum = 0;
        this.mire += S.mire_per_footfall;
        if (this.mire >= S.mire_threshold && !this.mired) {
          this.mired = true; this.mireEscapes = 0;
          this.events.push({ kind: 'mired' });
        }
      }
    } else {
      this.mireDecay = (this.mireDecay || 0) + 1;
      if (this.mireDecay >= S.mire_decay_frames) { this.mireDecay = 0; this.mire = Math.max(0, this.mire - 1); }
      if (this.mire === 0) this.mired = false;
    }

    // ---- 9b. breaking out of the mire ---------------------------------------------------------
    // RI-WLD10 §4: "escape := one `roll` press per 30 f, costing 25 stamina, 3 successes to break
    // out; on break out := 20 f recovery, mire := 0". Without this MIRED is a kill volume, which
    // is precisely what the item says it must not be ("MIRED is survivable, expensive, and
    // something a competent player walks around").
    if (this.mired) {
      if (this.mireRecovery > 0) { this.mireRecovery--; if (this.mireRecovery === 0) this.mired = false; }
      else if (this.escapePressed && (p.frameNow || 0) - (this.lastEscapeF || -999) >= S.mire_escape_cooldown_frames) {
        this.lastEscapeF = p.frameNow || 0;
        if ((this.body ? this.body.stamina : p.stamina) >= S.mire_escape_cost_stamina) {
          this._spendStamina(p, S.mire_escape_cost_stamina);
          this.mireEscapes++;
          this.events.push({ kind: 'mire_struggle', successes: this.mireEscapes });
          if (this.mireEscapes >= S.mire_escape_successes) {
            this.mire = 0; this.mireEscapes = 0;
            this.mireRecovery = S.mire_break_recovery_frames;
            this.events.push({ kind: 'mire_break' });
          }
        }
      }
    }
    this.escapePressed = false;

    // ---- 10. the state the player is in -------------------------------------------------------
    if (p.state !== 'DEATH') {
      if (this.mired) this._setState(p, 'MIRED');
      else if (this.airborne) this._setState(p, 'FALL');
      else if (swimming) this._setState(p, this.submerged ? 'SUBMERGED' : 'SWIM');
    }
    return this;
  }

  _land(p, ground, x, z) {
    const C = this.cfg;
    const from = this.apexY === null ? p.pos[1] : this.apexY;
    const dist = Math.max(0, from - ground);
    p.pos[1] = ground;
    this.airborne = false;
    this.vy = 0;
    this.apexY = null;
    // RI-WLD10 §2: fall damage is computed against the WATER SURFACE, x0.25 above 1.40 m of depth.
    const depth = this.field.depthAt(x, z);
    const soft = depth > C.fall.water_soften_depth_m ? C.fall.water_damage_mult : 1.0;
    const span = C.fall.lethal_m - C.fall.safe_m;
    const frac = dist <= C.fall.safe_m ? 0
      : Math.min(1, Math.pow((dist - C.fall.safe_m) / span, C.fall.curve_exponent));
    const dmg = frac * p.hpMax * soft;
    this.lastFall = { distance_m: +dist.toFixed(2), damage: +dmg.toFixed(2), water_depth_m: +depth.toFixed(2), softened: soft < 1 };
    if (dmg > 0) {
      this._damage(p, dmg);
      this.events.push({ kind: 'fall_damage', distance_m: +dist.toFixed(2), damage: +dmg.toFixed(2) });
      if (p.hp <= 0) { this._setState(p, 'DEATH'); this.events.push({ kind: 'fall_death' }); }
      else if (dist >= C.fall.stagger_from_m) {
        this._setState(p, 'STAGGER');
        const until = (p.frameNow || 0) + C.fall.stagger_frames;
        p.actionableAt = until;
        if (this.body) { this.body.actionableAt = until; this.body.move = null; }
      }
    }
    this.events.push({ kind: 'landed', distance_m: +dist.toFixed(2), damage: +dmg.toFixed(2) });
  }

  // ---- writes that survive the mirror ---------------------------------------------------------
  _damage(p, amount) {
    if (this.body) { this.body.hp = Math.max(0, this.body.hp - amount); p.hp = this.body.hp; }
    else p.hp = Math.max(0, p.hp - amount);
  }
  _spendStamina(p, amount) {
    if (this.body) { this.body.stamina = Math.max(0, this.body.stamina - amount); p.stamina = this.body.stamina; }
    else p.stamina = Math.max(0, p.stamina - amount);
  }
  _setState(p, s) {
    p.state = s;
    if (this.body) this.body.state = s;
  }

  /** Declared vs observed, in one object. */
  report() {
    return {
      declared: this.cfg,
      observed: {
        band: this.band, depth_m: +this.depth.toFixed(3), substrate: this.substrate || null,
        slope_deg: this.slopeDeg === undefined ? null : +this.slopeDeg.toFixed(2),
        airborne: this.airborne, vertical_mps: +this.vy.toFixed(3),
        sliding: this.slide > 0, slide_mps: +this.slide.toFixed(2),
        submerged: this.submerged, sinking: !!this.sinking, breath_s: +this.breath.toFixed(2),
        breath_max_s: this.cfg.water.breath_max_s,
        breathes_water: !!this.breathesWater, buoyant: !!this.buoyant,
        stamina_drain_per_s: this.staminaDrainPerS || 0,
        regen_suppressed: !!this.regenSuppressed,
        mire: this.mire, mired: this.mired,
        blocked_by_slope: this.blockedBySlope,
        on_deck: this.onDeck || null,
        on_road: !!this.onRoad,
        denies: { sprint: this.denies('sprint'), roll: this.denies('roll'), attack: this.denies('attack') },
        last_fall: this.lastFall,
      },
    };
  }
}
