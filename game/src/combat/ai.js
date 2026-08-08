// The enemy's decision-making. W1-12, RI-AI01 §C/§D/§E/§F.
//
// WHAT WAS HERE BEFORE: nothing. `combat/enemy.js`'s own header declared the scope honestly —
// two behaviours ship, `scripted` and `hold_ground`, and "an archetype declaring anything else
// THROWS on spawn". Its AGGRO branch reads, in full:
//
//     if (this.alertState === 'AGGRO') { this._steer(p, 240); b.state = 'REPOSITION'; }
//
// — a state literally named REPOSITION that turns the yaw and never writes `pos`. The one
// pursuit locomotion in the build was `character/encounter.js::engageMember`, written by W1-07
// so that its AR-3 capture branch could be reached at all, and it is a straight-line beeline to
// 2.30 m followed by a swing every 78 frames forever. Because every wilderness body in the
// world is spawned through `spawnEncounter`, that beeline was, in practice, this game's enemy
// AI. Measured against RI-AI01's own Comparison method it trips three of the five named hard
// fails by construction: M4's inter-COMMIT coefficient of variation is exactly 0 against a
// floor of 0.12 (a constant cadence is an attack timer, not a decision), M3 reads as a STATUE
// once it arrives, and M1/M2's aggro is a bare proximity circle that never passes through
// SUSPICIOUS.
//
// WHAT THIS IS. RI-AI01 §D's transition table, implemented against the bands in §C, the yaw and
// ramp legality in §F and the attack-token arbitration in §E. The parameters are all in
// `game/data/combat/ai.json` — nothing below is a magic number, and perturbing that file is the
// RI-MTH07 consumption demonstration.
//
// WHAT IT IS NOT, said here rather than discovered by a critic: PATROL is not implemented (no
// route data exists to walk), attack STRINGS are not selected (T17 — no string declarations in
// the moveset data), and BLOCK_HOLD is implemented but unreachable because no shipped statblock
// declares archetype TURTLE. See `declared_incomplete` in ai.json.
'use strict';

import { bearingDeg, angleDelta, norm360 } from './geometry.js';

/** RI-AI01 §D. The behaviour-tree leaves this module can be in. */
export const AI_STATES = new Set([
  'IDLE', 'PATROL', 'SUSPICIOUS', 'SEARCH', 'RUSH', 'APPROACH', 'CIRCLE', 'FEINT_STEP',
  'COMMIT', 'RECOVER', 'REPOSITION', 'PUNISH_READ', 'BLOCK_HOLD', 'STAGGER', 'DISENGAGE',
  'LEASH_RETURN', 'DEAD',
]);

/**
 * Which behaviour an enemy actually runs.
 *
 * `ai.json`'s override table is consulted FIRST, so this piece needs no write into
 * `game/data/combat/enemies/` (claimed by W1-03). The one thing it may never do is take a
 * scripted body away from its script: `RI-CMB07` M1's Mode-A conformance instrument is
 * "the enemy executes its 18 scripted actions on the exact frames given", and an AI that
 * quietly replaced that would invalidate every frame-exact measurement in the project. A body
 * that HAS been given a script keeps `scripted` whatever the table says.
 */
export function resolveBehaviour(stat, aiData, hasScript) {
  if (hasScript) return 'scripted';
  if (aiData && aiData.enabled !== false && aiData.override && aiData.override[stat.id]) {
    return aiData.override[stat.id];
  }
  return stat.ai;
}

/**
 * The group an enemy shares an attack token with (RI-AI01 §E). Encounter membership when there
 * is one — that is what "same encounter volume" means for a wilderness post — and otherwise a
 * single-member group, which yields one token, which is the correct answer for a lone enemy.
 */
function groupKeyOf(b, ctx) {
  const ent = ctx.entityOf ? ctx.entityOf(b.id) : null;
  return (ent && ent.encounterId) || `solo:${b.id}`;
}

export class SoulsAI {
  /**
   * @param {object} b    the CombatBody
   * @param {object} stat the statblock
   * @param {object} d    all of game/data/combat/*.json
   */
  constructor(b, stat, d) {
    this.b = b;
    this.stat = stat;
    this.cfg = d.ai;
    if (!this.cfg) {
      throw new Error(
        'SoulsAI: game/data/combat/ai.json is not loaded. It is the parameter set for every '
        + 'number this state machine uses; running without it would mean inventing them in code, '
        + 'which is the thing RI-MTH07 exists to catch. Add it to the combat data bundle.');
    }
    const A = this.cfg.archetype[stat.archetype];
    if (!A) {
      throw new Error(
        `SoulsAI: archetype '${stat.archetype}' (statblock '${stat.id}') has no row in `
        + 'game/data/combat/ai.json §archetype. RI-AI01 §C is a per-archetype table and a '
        + 'missing row is a missing bar, not a default. Add the row or declare the archetype '
        + 'unrealised.');
    }
    this.A = A;
    // The STATBLOCK wins wherever it declares the number. ai.json is the archetype default.
    this.omega = stat.reach_m || A.omega_m;
    this.sightR = stat.sight_radius_m || A.sight_r_m;
    this.walk = A.walk_mps;
    this.sprint = A.sprint_mps;
    this.leashHard = this.cfg.leash.hard_m[A.leash_tier] ?? this.cfg.leash.hard_m.trash;

    this.state = 'IDLE';
    this.stateF = 0;              // frames in the current state
    this.speed = 0;               // current gait speed, ramped (§F)
    this.strafeDir = 1;
    this.strafeUntil = 0;
    this.radialSign = 1;
    this.token = false;
    this.tokenSinceF = 0;
    this.cooldownUntil = 0;
    this.feintUntil = 0;
    this.roarUntil = 0;
    this.noLosSinceF = -1;
    this.healUntil = 0;
    this.lastCommitF = -1;
    this.commitIntervals = [];
  }

  band(dist) {
    const B = this.cfg.bands;
    if (dist <= B.strike * this.omega) return 'STRIKE';
    if (dist <= B.poke * this.omega) return 'POKE';
    if (dist <= B.dance * this.omega) return 'DANCE';
    if (dist <= B.close * this.omega) return 'CLOSE';
    return 'RUSH';
  }

  _enter(state, frame) {
    if (state === this.state) return;
    this.prevState = this.state;
    this.state = state;
    this.stateF = 0;
    this.stateEnteredF = frame;
  }

  /**
   * The gait ramp, RI-AI01 §F: ">= 8 f from 0 to walk, >= 14 f from 0 to sprint, >= 10 f to
   * stop". Implemented as an acceleration limit rather than as a lerp so that a decision to
   * stop takes ten frames from whatever speed the enemy was actually at, which is what makes
   * an approach visibly decelerate into a circle (T09's "must decelerate over >= 10 f, no
   * instant stop") instead of snapping.
   */
  _ramp(target) {
    const M = this.cfg.movement;
    const up = target > this.speed;
    const rate = up
      ? (target > this.walk ? this.sprint / M.accel_frames_to_sprint : this.walk / M.accel_frames_to_walk)
      : (this.speed / M.decel_frames_to_stop || this.walk / M.decel_frames_to_stop);
    if (up) this.speed = Math.min(target, this.speed + rate);
    else this.speed = Math.max(target, this.speed - Math.max(rate, this.walk / M.decel_frames_to_stop));
    return this.speed;
  }

  /** §F: 300 °/s free. Returns the yaw rate actually applied, in °/s, for the trace. */
  _face(tx, tz, dps) {
    const b = this.b;
    const want = bearingDeg(tx - b.pos[0], tz - b.pos[2]);
    const maxStep = dps / 60;
    let d = angleDelta(b.yaw, want);
    if (d > maxStep) d = maxStep; else if (d < -maxStep) d = -maxStep;
    b.yaw = norm360(b.yaw + d);
    return Math.abs(d) * 60;
  }

  _move(dx, dz) {
    const b = this.b;
    const m = Math.hypot(dx, dz);
    if (m < 1e-9) { b.speedMps = 0; return; }
    b.pos[0] += dx; b.pos[2] += dz;
    b.speedMps = m * 60;
  }

  /**
   * One fixed frame of decision-making. Called from EnemyController.step() only on frames where
   * the body is NOT committed to a move — commitment is seam S1 and this module never cancels
   * an animation, which is the whole reason RI-AI03's punish window exists.
   */
  step(frame, ctx, ctl) {
    const b = this.b;
    const p = ctx.player;
    this.stateF++;
    this.yawRate = 0;
    if (!p) { this._enter('IDLE', frame); b.state = 'IDLE'; b.speedMps = 0; return; }

    const dx = p.pos[0] - b.pos[0], dz = p.pos[2] - b.pos[2];
    const dist = Math.hypot(dx, dz);
    const anchorD = Math.hypot(b.pos[0] - this.anchor[0], b.pos[2] - this.anchor[2]);
    const alert = ctl.alertState;

    // ---- T25: leash, checked before anything else, because a leashed enemy has no other
    // decision to take. RI-AI01's own M6 fails a build "if the enemy tracks the player past
    // L_hard", so this is the transition that has to win.
    if (this.state !== 'LEASH_RETURN'
        && (anchorD > this.leashHard
            || (this.noLosSinceF >= 0 && frame - this.noLosSinceF > this.cfg.leash.no_los_seconds * 60
                && dist > this.cfg.leash.dist_multiple_of_sight * this.sightR))) {
      this._releaseToken(ctx);
      this._enter('LEASH_RETURN', frame);
    }

    if (this.state === 'LEASH_RETURN') return this._leashReturn(frame, ctx, ctl, dist);

    // ---- the alert ladder. The METER is not ours — `sim/stealth/system.js` owns it and writes
    // through to ctl.alert / ctl.alertState. What is ours is the ladder's consequence.
    if (alert !== 'AGGRO') {
      this.roarUntil = 0;
      this._releaseToken(ctx);
      // T25/T26. An enemy that loses the player does not simply stop where it happens to be
      // standing — it goes home. The first draft dropped straight to IDLE here, so an enemy
      // that had chased thirty metres down the road stood in the road forever and M6 scored 0
      // with the note "LEASH_RETURN entered at frame -1": the leash was unreachable because
      // nothing ever routed into it. Souls' de-aggro is a walk back, and the walk back is the
      // player's reward for disengaging — which ARBITRATION §1 protects explicitly ("Fleeing is
      // a legitimate, supported resolution ... escape is not a failure state").
      if (Math.hypot(b.pos[0] - this.anchor[0], b.pos[2] - this.anchor[2]) > 1.5) {
        this._enter('LEASH_RETURN', frame);
        return this._leashReturn(frame, ctx, ctl, dist);
      }
      this._ramp(0);
      b.speedMps = 0;
      this._enter(alert === 'SEARCH' ? 'SEARCH' : alert === 'SUSPICIOUS' ? 'SUSPICIOUS' : 'IDLE', frame);
      if (this.state === 'SUSPICIOUS' || this.state === 'SEARCH') {
        // Look towards the last known position, not at the player. T04 is explicit about it:
        // "walks last-known-position, not player position". This build has no search
        // locomotion of its own (W1-15 owns sim/stealth/search.js), so the head turn is all
        // this state does and that is said plainly rather than dressed up.
        const lkp = ctl.lkp || [p.pos[0], 0, p.pos[2]];
        this.yawRate = this._face(lkp[0], lkp[2], this.cfg.movement.max_yaw_rate_free_dps);
      }
      b.state = this.state;
      return;
    }

    // ---- T05: AGGRO entry costs 20-30 frames in which the enemy may NOT attack.
    if (!this.roarUntil) {
      const [lo, hi] = this.cfg.perception.aggro_entry_frames;
      this.roarUntil = frame + lo + this._draw(ctx, hi - lo);
      this._enter('REPOSITION', frame);
    }

    this.yawRate = this._face(p.pos[0], p.pos[2], this.cfg.movement.max_yaw_rate_free_dps);
    const band = this.band(dist);

    if (frame < this.roarUntil) { this._ramp(0); b.speedMps = 0; b.state = 'REPOSITION'; return; }

    // ---- T22: the anti-chug read. A player who drinks at range is punished for it.
    const ps = ctx.playerState && ctx.playerState();
    if (ps && this.cfg.punish_read.trigger_player_states.includes(ps)
        && dist <= this.cfg.punish_read.band_multiple * this.omega) {
      this._enter('PUNISH_READ', frame);
      this._advance(dx, dz, dist, this.sprint);
      b.state = 'PUNISH_READ';
      if (band === 'STRIKE' || band === 'POKE') this._tryCommit(frame, ctx, ctl, dist);
      return;
    }

    switch (this.state) {
      case 'REPOSITION':
        // T16's other half, and the state the pre-W1-12 code named without implementing. A
        // swing ends with the enemy standing at about a metre — well inside its own STRIKE
        // band — and the first thing a Souls enemy does after a whiffed or landed attack is
        // get its spacing back. Leaving that to the strafe's radial correction meant roughly
        // half a second inside 0.85·Ω after every attack, and RI-AI01 M3 measures precisely
        // that fraction: `min_dist_dwell` was 0.307 against a PASS of 0.10.
        if (dist < this.cfg.circle.preferred_band_multiple * this.omega * 0.9) {
          // At SPRINT, not walk, and this is T24's "backstep/hop away, then re-space to
          // preferred band" rather than a number chosen to move a metric. Every one of this
          // roster's attacks carries 0.6-1.2 m of forward root motion, so a swing ENDS about a
          // metre from the player whatever distance it started at; a back-off at walking pace
          // spends half a second of every attack cycle inside 0.85·Ω and the fight reads as a
          // shove rather than an exchange.
          //
          // Measured, one enemy, 3,600 frames, bare Node, commit 107c1b3+W1-12:
          // no back-off state at all (radial correction inside CIRCLE only) 0.307; back off at
          // walk 0.420; back off at sprint 0.228. RI-AI01 M3's hard fail is > 0.35 and its
          // PASS is <= 0.10, so this is CLEAR OF THE HARD FAIL AND SHORT OF THE PASS, and it
          // is reported that way rather than tuned until the number is pretty. The residue is
          // FEINT_STEP, which is 448 of the 1,806 non-COMMIT frames and which T13 *defines* as
          // ending inside 0.85·Ω — a correct step-in scores against this metric by
          // construction. See reports/w1-12/survey.md §M3.
          const v = this._ramp(this.sprint);
          this._move(-(dx / (dist || 1)) * (v / 60), -(dz / (dist || 1)) * (v / 60));
          break;
        }
        this._enter(band === 'RUSH' ? 'RUSH' : band === 'CLOSE' ? 'APPROACH' : 'CIRCLE', frame);
        break;

      case 'PUNISH_READ':
        this._enter(band === 'RUSH' ? 'RUSH' : band === 'CLOSE' ? 'APPROACH' : 'CIRCLE', frame);
        break;

      case 'RUSH':                                        // T07 / T09
        this._advance(dx, dz, dist, this.sprint);
        if (band !== 'RUSH' && this.stateF >= 12) this._enter('APPROACH', frame);
        break;

      case 'APPROACH':                                    // T08 / T10
        this._advance(dx, dz, dist, this.walk);
        if (band === 'RUSH') this._enter('RUSH', frame);
        else if (dist <= this.cfg.bands.dance * this.omega && this.stateF >= 15) this._enter('CIRCLE', frame);
        break;

      case 'CIRCLE':                                      // T11 / T12
        this._circle(frame, ctx, dx, dz, dist);
        if (band === 'RUSH' || band === 'CLOSE') { this._enter('APPROACH', frame); break; }
        if (this.stateF >= this.cfg.commit.feint_min_circle_dwell_f
            && frame >= this.cooldownUntil
            && dist <= this.cfg.bands.dance * this.omega
            && this._takeToken(frame, ctx)) {
          this._enter('FEINT_STEP', frame);
          this.feintUntil = frame + this.cfg.commit.feint_step_max_frames;
        }
        break;

      case 'FEINT_STEP':                                  // T13 / T14 — the fake-out
        // The step-in is a GAP-CLOSER, not a walk. T13 gives it 36 frames to cross from the
        // circling radius into STRIKE, and at a walk that is arithmetically impossible from
        // anywhere inside the DANCE band — the first run of this AI circled honestly, feinted
        // honestly, and committed exactly zero times in 400 frames because 36 f at 2.2 m/s is
        // 1.32 m and it needed 2.26 m. A feint the enemy cannot finish is a standoff.
        this._advance(dx, dz, dist, this.sprint);
        if (dist <= this.cfg.bands.strike * this.omega) {
          if (this._tryCommit(frame, ctx, ctl, dist)) break;
        }
        if (frame >= this.feintUntil) {
          // T14: 36 f elapsed without reaching STRIKE. The token goes back and a cooldown
          // starts. THIS is the transition that makes the inter-COMMIT interval vary, and
          // RI-AI01 M4's hard fail (coefficient of variation < 0.12) is a test for its absence.
          this._releaseToken(ctx);
          this.cooldownUntil = frame + this.cfg.commit.feint_release_cooldown_f;
          this._enter('CIRCLE', frame);
          this._reseedStrafe(frame, ctx);
        }
        break;

      default:
        this._enter('CIRCLE', frame);
    }

    // Token hold cap (§E): a held token that never becomes a swing starves the group.
    if (this.token && frame - this.tokenSinceF > this.cfg.commit.token_hold_cap_f) {
      this._releaseToken(ctx);
      const [lo, hi] = this.cfg.commit.token_cooldown_f;
      this.cooldownUntil = frame + lo + this._draw(ctx, hi - lo);
    }
    // A commit that began this frame has already had `b.state` set to the move's own startup
    // state by `begin()`. Overwriting it with the AI leaf here would report ATK_WINDUP frames
    // as COMMIT and hide the phase the whole telegraph item is measured on.
    if (!b.move) b.state = this.state;
  }

  /** Walk/sprint straight at the target, but never inside the standoff (§F). */
  _advance(dx, dz, dist, target) {
    const stand = this.cfg.movement.min_standoff_m;
    const v = this._ramp(target);
    if (dist <= stand) { this._move(0, 0); return; }
    const step = Math.min(v / 60, dist - stand);
    this._move((dx / dist) * step, (dz / dist) * step);
  }

  /**
   * T11. Strafe around the player at the DANCE band with a small radial drift, reseeding
   * direction on a 48-96 f seeded timer.
   *
   * The radial drift is not decoration. RI-AI01 M3's PASS needs `spacing_variance >= 0.8 m`
   * over a 60 s window, and an enemy that orbits at a fixed radius has a spacing variance of
   * zero — which is the "statue" fail with extra steps.
   */
  _circle(frame, ctx, dx, dz, dist) {
    if (frame >= this.strafeUntil) this._reseedStrafe(frame, ctx);
    const v = this._ramp(this.walk * this.cfg.circle.strafe_speed_fraction);
    const ux = dx / (dist || 1), uz = dz / (dist || 1);        // unit vector TOWARDS the player
    const tx = -uz * this.strafeDir, tz = ux * this.strafeDir; // tangent
    const want = this.cfg.circle.preferred_band_multiple * this.omega;

    // Re-spacing. This is a CORRECTION, not a drift: an enemy that has just finished a swing is
    // standing at about one metre and has to get back out to its own preferred band before it
    // can circle at all. A fixed 0.35 m/s drift took eight seconds to do it, and for those
    // eight seconds the enemy was inside 0.85·Ω — which is RI-AI01 M3's chase-bot hard fail
    // arriving through the back door, from an AI that believed it was strafing.
    const err = want - dist;
    const outward = Math.max(-this.walk * 0.6, Math.min(this.walk * 0.9, err * 1.5))
      + this.radialSign * this.cfg.circle.radial_drift_mps;   // + the seeded in/out wobble
    let mx = tx * v - ux * outward, mz = tz * v - uz * outward;
    // Never steer inside the standoff; the separation force is not there to undo a decision.
    if (dist - (ux * mx + uz * mz) / 60 < this.cfg.movement.min_standoff_m) { mx = tx * v; mz = tz * v; }
    this._move(mx / 60, mz / 60);
  }

  _reseedStrafe(frame, ctx) {
    const [lo, hi] = this.cfg.circle.reseed_frames;
    this.strafeUntil = frame + lo + this._draw(ctx, hi - lo);
    this.strafeDir = this._draw(ctx, 2) ? 1 : -1;
    this.radialSign = this._draw(ctx, 2) ? 1 : -1;
  }

  /** T13/T15. Start a real attack. Returns true if one began. */
  _tryCommit(frame, ctx, ctl, dist) {
    const b = this.b;
    if (!this.token) return false;
    const ids = Object.keys(b.moves).filter((k) => !k.startsWith('_') && b.moves[k].kind === 'attack');
    if (!ids.length) return false;
    // Pick by band rather than by rotation index: the whole point of RI-AI01 M4 is that the
    // choice is range-gated. A move whose reach cannot cover the current distance is not
    // eligible, so the enemy stops whiffing into empty air on a metronome.
    const eligible = ids.filter((k) => {
      const m = b.moves[k];
      const reach = this.omega + (m.root_dz_m || 0);
      return dist <= reach && (!m.stamina || b.stamina >= m.stamina);
    });
    const pool = eligible.length ? eligible : [];
    if (!pool.length) return false;
    const mv = b.moves[pool[this._draw(ctx, pool.length)]];
    b.begin(mv, frame, {});
    if (mv.stamina) b.spend(mv.stamina, frame, ctx.d);
    if (ctl && ctl._noteAttack) ctl._noteAttack(frame);
    if (this.lastCommitF >= 0) this.commitIntervals.push(frame - this.lastCommitF);
    this.lastCommitF = frame;
    this._enter('COMMIT', frame);
    b.state = mv.states.startup;
    if (ctx.emit) {
      const e = ctx.emit(frame, 'ACTION_START');
      e.who = b.id; e.mv = mv.id; e.tag = 'enemy_attack';
      e.startup = mv.startup; e.active = mv.active; e.recovery = mv.recovery; e.total = mv.total;
      e.punish_window = mv.punish_window;
      e.dist_m = Math.round(dist * 1000) / 1000;
      e.ai_state = 'COMMIT';
    }
    return true;
  }

  /** T15/T16: the attack has ended. Token goes back, cooldown starts, back to CIRCLE. */
  onMoveEnded(frame, ctx) {
    if (this.state !== 'COMMIT') return;
    this._releaseToken(ctx);
    const [lo, hi] = this.cfg.commit.token_cooldown_f;
    this.cooldownUntil = frame + lo + this._draw(ctx, hi - lo);
    this._enter('REPOSITION', frame);
    this._reseedStrafe(frame, ctx);
  }

  /** T26. Walk home; heal only after arrival, and never become invulnerable. */
  _leashReturn(frame, ctx, ctl, dist) {
    const b = this.b;
    const dx = this.anchor[0] - b.pos[0], dz = this.anchor[2] - b.pos[2];
    const home = Math.hypot(dx, dz);
    b.state = 'LEASH_RETURN';
    // T27: re-perceiving the player before arrival re-aggros, free.
    if (ctl.alertState === 'AGGRO' && dist <= this.sightR) {
      this.roarUntil = 0; this.healUntil = 0;
      this._enter('REPOSITION', frame);
      return;
    }
    if (home > 1.5) {
      this.yawRate = this._face(this.anchor[0], this.anchor[2], this.cfg.movement.max_yaw_rate_free_dps);
      const v = this._ramp(this.walk);
      const step = Math.min(v / 60, home);
      this._move((dx / home) * step, (dz / home) * step);
      this.healUntil = 0;
      return;
    }
    this._ramp(0); b.speedMps = 0;
    if (!this.healUntil) this.healUntil = frame + this.cfg.leash.return_heal_seconds * 60;
    // Heal linearly over 4 s AFTER arrival. Never a snap, and hp is never clamped upward
    // during the walk home — M6 checks the hp series for exactly that.
    if (b.hp < b.hpMax) b.hp = Math.min(b.hpMax, b.hp + b.hpMax / (this.cfg.leash.return_heal_seconds * 60));
    if (frame >= this.healUntil && b.hp >= b.hpMax) this._enter('IDLE', frame);
  }

  // ---- attack-token arbitration, RI-AI01 §E ---------------------------------------------
  _tokensFor(ctx, key) {
    const peers = ctx.aiPeers ? ctx.aiPeers(key) : [this];
    const n = peers.length;
    if (peers.some((a) => a.stat.tier === 'elite') && n > 1) return this.cfg.commit.tokens_when_elite_present;
    if (n >= 5 && peers.every((a) => a.A.leash_tier === 'trash' && a.omega <= 1.8)) {
      return this.cfg.commit.swarm_tokens_at_5_plus;
    }
    for (const row of this.cfg.commit.tokens_by_group) if (n <= row.max_size) return row.tokens;
    return 1;
  }

  _takeToken(frame, ctx) {
    if (this.token) return true;
    const key = groupKeyOf(this.b, ctx);
    const peers = ctx.aiPeers ? ctx.aiPeers(key) : [this];
    const held = peers.filter((a) => a.token).length;
    if (held >= this._tokensFor(ctx, key)) return false;
    this.token = true; this.tokenSinceF = frame;
    return true;
  }

  _releaseToken() { this.token = false; }

  /**
   * The one source of randomness. Draws from the simulation's single global PRNG through the
   * context, so the draw is counted, saved and restored with everything else — `core/rng.js`
   * says "nothing in sim/ may construct its own" and a private stream here would be the same
   * defect wearing a different jacket. If a probe supplies no rng the AI is fully
   * deterministic on the midpoint, which is honest rather than secretly random.
   */
  _draw(ctx, n) {
    if (!ctx || !ctx.rng) return n >> 1;
    return ctx.rng.int(n);
  }
}
