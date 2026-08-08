// The enemy side of the fight.
//
// SCOPE, declared rather than blurred. **Enemy AI is RI-AI01–RI-AI07 and wave-1 piece W1-12.**
// W1-09 owns how fighting WORKS, on both sides of the exchange, and it needs an opponent that
// really swings so that i-frame negation, blocking, guard break, poise, backstab, riposte and
// parley are things a trace can prove rather than things a builder can claim. What it does NOT
// own is when an enemy decides to swing.
//
// The resolution is the one RI-CMB07 M1 already specifies for Mode-A: **a SCRIPTED attack
// machine.** "The enemy executes its 18 scripted actions on the exact frames given; the player
// executes the 54 scripted inputs on the exact frames given. No AI, no randomness, seed 0."
// A scripted opponent is not an AI stub — it is the instrument the corpus asks for, and it is
// the only opponent against which a frame-exact conformance claim means anything.
//
// Two behaviours ship:
//   * `scripted`   — actions from the scenario file, on declared frames. The Mode-A instrument.
//   * `hold_ground`— perception, turn-to-face, no attack. Inherited from W1-00 unchanged.
// An archetype declaring anything else THROWS on spawn, exactly as W1-00 made it throw, because
// a plausible-but-wrong enemy is worse than an absent one.
'use strict';

import { Clip, LoopClip } from './clips.js';
import { bearingDeg, angleDelta, norm360 } from './geometry.js';
import { applyPoiseDamage } from './rules.js';
import { SoulsAI, resolveBehaviour } from './ai.js';

// ---- AMENDED W1-12 ---------------------------------------------------------------------
// `souls` is added to the set, additively; the three behaviours above it are unchanged and
// `scripted` still wins for any body that has actually been handed a script, so RI-CMB07 M1's
// frame-exact Mode-A instrument is untouched. See `resolveBehaviour` in ./ai.js.
export const IMPLEMENTED_AI = new Set(['none', 'hold_ground', 'scripted', 'souls']);

/**
 * Which damage type an enemy attack's pose archetype delivers, when the statblock does not say.
 * RI-WPN05 §B owns the shape -> damage-type mapping; this only maps ARCHETYPE -> shape, so an
 * enemy overhead chop strikes and an enemy thrust thrusts rather than everything slashing.
 */
const SHAPE_OF_ARCHETYPE = {
  chop_overhead: 'slash_v', thrust: 'thrust', sweep_wide: 'sweep', cut_diagonal: 'slash_d',
  cut_horizontal: 'slash_h', cut_horizontal_rev: 'slash_h', smash_overhead: 'smash',
  slam: 'smash', crit_thrust: 'thrust', grab: 'grab', lash: 'lash', spin: 'spin',
};

/** Build an enemy's move table from its statblock's declared attacks. */
export function buildEnemyMoves(stat, data, weapon) {
  const arch = data.clips.archetypes;
  const out = { _weapon: weapon, _movesetId: `enemy:${stat.id}`, _classKey: stat.id };
  for (const id of Object.keys(stat.attacks || {})) {
    const a = stat.attacks[id];
    const total = a.startup + a.active + a.recovery;
    out[id] = {
      id,
      kind: 'attack',
      anim: a.anim || `e_${id}`,
      clip: new Clip(a.anim || `e_${id}`, arch[a.archetype || 'cut_diagonal'],
        { startup: a.startup, active: a.active, total }, a.amplitude || 1.0, a.root_dz_m || 0),
      startup: a.startup,
      Ps: a.startup + 1,
      active: a.active,
      recovery: a.recovery,
      total,
      stamina: a.stamina || 0,
      poise_damage: a.poise_damage || 0,
      motion_value: a.motion_value || 1.0,
      hyperarmour_window: a.hyperarmour_window || null,
      unblockable: !!a.unblockable,
      hitbox: true,
      hitbox_radius_m: a.hitbox_radius_m || weapon.radius_m,
      hitstop_frames: a.hitstop_frames || 6,
      // RI-WPN05 §A/§B apply symmetrically: an enemy blade meeting the player's flesh reads the
      // same tables the player's blade does. `shape` picks the damage type; `weight_tier` picks
      // the hitstop and knockback rows. Both are declarable per attack and default honestly —
      // an enemy statblock that says nothing gets the medium row and a slashing shape, which is
      // what its `cut_diagonal`/`sweep_wide` archetypes already are.
      shape: a.shape || SHAPE_OF_ARCHETYPE[a.archetype] || 'slash_d',
      weight_tier: a.weight_tier || stat.weight_tier || 'medium',
      weapon_class: null,
      hitstop_f_table: a.hitstop_f || null,
      root_dz_m: a.root_dz_m || 0,
      iframes: null,
      hard_until: total,
      states: { startup: 'ATK_WINDUP', active: 'ATK_ACTIVE', recovery: 'ATK_RECOVER' },
      // RI-AI03 consumes these. The enemy's recovery IS the punish window.
      punish_window: [a.startup + a.active + 1, total],
      source: `game/data/combat/enemies/${stat.id}.json`,
    };
  }
  // reaction moves, so an enemy staggers, guard-breaks and dies like a player does
  out._stagger = {};
  for (const t of data.poise.stagger.tiers) {
    out._stagger[t.tier] = {
      id: `stagger_${t.tier}`, kind: 'stagger', anim: `e_stagger_${t.tier}`,
      clip: new Clip(`e_stagger_${t.tier}`, arch.stagger_recoil,
        { startup: Math.ceil(t.frames * 0.3), active: Math.ceil(t.frames * 0.3), total: t.frames }, 1.0, -t.pushback_m),
      total: t.frames, knockdown: !!t.knockdown, pushback_m: t.pushback_m, poise_damage_range: t.poise_damage,
      hitbox: false, iframes: null,
      states: { startup: 'STAGGER', active: 'STAGGER', recovery: 'STAGGER' },
      source: 'RI-CMB05 §B, applied symmetrically to enemies',
    };
  }
  const gb = data.stamina.guard_break;
  out._guardBreak = {
    id: 'guard_break', kind: 'guard_break', anim: 'e_guard_break',
    clip: new Clip('e_guard_break', arch.guard_break_open, { startup: 10, active: 10, total: gb.duration_f }, 1.0, -0.25),
    total: gb.duration_f, riposte_window: gb.riposte_window, hitbox: false, iframes: null,
    states: { startup: 'GUARD_BREAK', active: 'GUARD_BREAK', recovery: 'GUARD_BREAK' },
    source: 'RI-CMB03 §D — "the identical rule applies to enemies"',
  };
  out._idle = new LoopClip('e_idle', arch.idle_loop, stat.idle_anim_frames || 96);
  out._walk = new LoopClip('e_walk', arch.locomotion_cycle, 44);
  out._run = out._walk; out._sprint = out._walk;
  out._blockPose = arch.block_hold;
  out._idlePose = arch.idle_ready;
  out._dead = new Clip('e_dead', arch.dead_collapse, { startup: 12, active: 12, total: 48 }, 1.0, 0.4);
  return out;
}

export class EnemyController {
  constructor(body, stat, data) {
    this.b = body;
    this.stat = stat;
    this.d = data;
    this.script = [];            // [{f, move}] absolute frames, set by the scenario
    this.scriptIdx = 0;
    this.attacksInWindow = [];   // for the beast WINDED rule (RI-CMB09 §4)
    this.winded = false;
    this.windedUntil = 0;
    this.alert = 0;
    this.alertState = 'IDLE';
    // Which channel filled the meter this frame — RI-STL01's requested `alert_channel`, whose
    // absence from the round-1 enemy record the verdict called "its own answer". Written by
    // sim/stealth/perception.js and read by sim/record.js.
    this.alertChannel = null;
    // ---- W1-12 -------------------------------------------------------------------------
    // The behaviour is resolved lazily, on the first step, and not here: `loadScript()` is
    // called AFTER the controller is constructed, so a constructor-time decision could not
    // see whether this body has a script and would take every scripted enemy in the project
    // away from its script.
    this.ai = null;
    this.behaviour = null;
  }

  /** Resolve `souls` vs `scripted` once, on the first frame, when the script is known. */
  _resolveAI() {
    if (this.behaviour) return this.behaviour;
    this.behaviour = resolveBehaviour(this.stat, this.d.ai, this.script.length > 0);
    if (this.behaviour === 'souls') {
      this.ai = new SoulsAI(this.b, this.stat, this.d);
      this.ai.anchor = [this.b.pos[0], this.b.pos[1], this.b.pos[2]];
    }
    return this.behaviour;
  }

  /** Scenario contract: enemy actions on declared frames, relative to the window origin. */
  loadScript(script, baseFrame) {
    this.script = (script || []).map((e) => ({ f: e.f + baseFrame, move: e.move, face: e.face }));
    this.script.sort((a, b) => a.f - b.f);
    this.scriptIdx = 0;
    return this.script.length;
  }

  step(frame, ctx) {
    const b = this.b;
    const emit = ctx.emit;
    if (b.dead) { b.state = 'DEAD'; b.poseDead(frame); return; }
    if (b.yielded) {
      b.state = 'YIELDED'; b.hitboxActive = false; b.poseLocomotion('IDLE', frame);
      b.tickResources(frame, this.d);
      return;
    }

    this._resolveAI();

    // Retire at the TOP of the step — see the note in combat/player.js.
    // T15/T16: the frame a committed attack retires is the frame the token goes back and the
    // enemy re-enters CIRCLE. Doing it here, at the retire, rather than in the AI's own step
    // means the punish window the player is standing in belongs entirely to RECOVER and the
    // AI cannot shorten it by deciding early.
    if (b.move && b.animFrame >= b.moveTotal()) {
      const wasAttack = b.move.kind === 'attack';
      b.endMove();
      if (wasAttack && this.ai) this.ai.onMoveEnded(frame, ctx);
    }

    if (b.move && (b.move.kind === 'stagger' || b.move.kind === 'guard_break')) {
      b.advance(frame);
      b.tickResources(frame, this.d);
      return;
    }
    if (frame < b.parriedUntil) {
      b.state = 'PARRIED'; b.animFrame++; b.hitboxActive = false;
      b.poseLocomotion('IDLE', frame);
      b.tickResources(frame, this.d);
      return;
    }

    // ---- start a scripted action ------------------------------------------------------------
    if (!b.move && this.stat.ai === 'scripted') {
      while (this.scriptIdx < this.script.length && this.script[this.scriptIdx].f < frame) this.scriptIdx++;
      if (this.scriptIdx < this.script.length && this.script[this.scriptIdx].f === frame) {
        const ev = this.script[this.scriptIdx++];
        // `face` is a SCENARIO authoring instrument — an absolute heading the author states,
        // so it is honoured exactly. Turning to look at the player is not: this used to snap
        // `b.yaw` to the player's bearing on the frame the attack began, which made RI-AI02's
        // tracking cutoff (the 180 °/s and 45 °/s bands applied three lines below, during
        // startup) decorative, because the enemy had already finished turning before the first
        // band opened. Measured: a 180° reversal moved the champion's weapon socket 3.390 m in
        // a single frame — 203 m/s against a declared 18.5 — and it was the largest single-frame
        // pose discontinuity anywhere in the build, larger than the transition snaps the pose
        // cross-fade was written for. The turn is now the same bounded turn everything else in
        // the fight uses.
        if (ev.face !== undefined) { b.yaw = norm360(ev.face); b.yawExempt = true; }
        else if (ctx.player) this._steer(ctx.player, this.d.locomotion ? (this.d.locomotion.turn_rate_stationary_dps || 480) : 480);
        // RI-WLD10 §5 R2/R5/R6 (S25), the enemy half — absent until now. `waterDeniesAttack` is
        // written every frame by `Engine._settleEnemyWater()`: true when this body's current
        // band exceeds its own declared `water_max_band` (fail-closed W0 if the statblock never
        // declared one, per §11). A `water_native` archetype declares W5, so nothing here ever
        // catches it — it stays exactly as dangerous in deep water as on land, because R1 means
        // nothing has touched its frame data either way. `unblock` (lowering guard) is exempt on
        // purpose: denying it would trap the enemy in a raised guard forever, which is not a
        // denial, it is a soft-lock.
        if (b.waterDeniesAttack && ev.move !== 'unblock') {
          const e = emit(frame, 'action_denied_by_water');
          e.who = b.id; e.button = ev.move; e.band = b.waterBand || 'W0'; e.water_max_band = b.waterMaxBand || 'W0';
        } else if (ev.move === 'block') {
          b.guardRaised = true;
          const e = emit(frame, 'GUARD_UP'); e.who = b.id;
        } else if (ev.move === 'unblock') {
          b.guardRaised = false;
        } else {
          const m = b.moves[ev.move];
          if (!m) {
            throw new Error(`enemy '${b.id}' scripted move '${ev.move}' is not declared in ` +
              `game/data/combat/enemies/${this.stat.id}.json §attacks. Known: ${Object.keys(b.moves).filter((k) => !k.startsWith('_')).join(', ')}. ` +
              'Refusing to silently do nothing on a scripted frame — that would be a fabricated measurement (RI-MTH04).');
          }
          if (m.stamina && b.stamina < m.stamina) {
            const e = emit(frame, 'INPUT_DROPPED');
            e.who = b.id; e.button = ev.move; e.reason = 'no_stamina'; e.have = round1(b.stamina); e.need = m.stamina;
          } else {
            b.begin(m, frame, {});
            if (m.stamina) b.spend(m.stamina, frame, this.d);
            this._noteAttack(frame);
            const e = emit(frame, 'ACTION_START');
            e.who = b.id; e.mv = m.id; e.tag = 'enemy_attack';
            e.startup = m.startup; e.active = m.active; e.recovery = m.recovery; e.total = m.total;
            e.punish_window = m.punish_window; e.stam_after = round1(b.stamina);
          }
        }
      }
    }

    // ---- advance ------------------------------------------------------------------------------
    if (b.move) {
      // RI-AI02's tracking cutoff, same schedule as the player's soft lock: an enemy that
      // lookAt()s the player every frame makes spacing meaningless and the fight unfair.
      if (b.move.kind === 'attack' && ctx.player) {
        const nf = b.animFrame + 1;
        if (nf > 1 && nf <= 0.40 * b.move.startup) this._steer(ctx.player, 180);
        else if (nf <= 0.80 * b.move.startup) this._steer(ctx.player, 45);
      }
      b.advance(frame);
    } else {
      this._idleBehaviour(frame, ctx);
    }

    // beasts: WINDED after >= 3 attacks in 6 s (RI-CMB09 §4 enemy symmetry)
    if (this.stat.winded_after) {
      const cutoff = frame - 360;
      while (this.attacksInWindow.length && this.attacksInWindow[0] < cutoff) this.attacksInWindow.shift();
      if (!this.winded && this.attacksInWindow.length >= this.stat.winded_after) {
        this.winded = true;
        this.windedUntil = frame + (this.stat.winded_frames || 75);
        const e = emit(frame, 'WINDED'); e.who = b.id; e.frames = this.stat.winded_frames || 75;
      } else if (this.winded && frame >= this.windedUntil) this.winded = false;
    }
    const ex = b.tickResources(frame, this.d);
    if (ex) { const e = emit(frame, ex === 'enter' ? 'EXHAUSTED_ENTER' : 'EXHAUSTED_EXIT'); e.who = b.id; e.stamina = round1(b.stamina); }
  }

  _noteAttack(frame) { this.attacksInWindow.push(frame); }

  _steer(target, dps) {
    const b = this.b;
    const want = bearingDeg(target.pos[0] - b.pos[0], target.pos[2] - b.pos[2]);
    const maxStep = dps / 60;
    let d = angleDelta(b.yaw, want);
    if (d > maxStep) d = maxStep; else if (d < -maxStep) d = -maxStep;
    b.yaw = norm360(b.yaw + d);
  }

  _idleBehaviour(frame, ctx) {
    const b = this.b;
    // ---- W1-12. The whole of RI-AI01 §D lives behind this one call ------------------------
    //
    // What it replaces, for a `souls` body, is the four lines at the bottom of this method:
    // an AGGRO enemy turned its yaw towards the player, set `b.state = 'REPOSITION'` and posed
    // an IDLE loop. Nothing wrote `b.pos`. The state was named for a movement the code did not
    // contain, which is why the W1-07 verdict could report six raiders sitting in REPOSITION
    // for 1,657 consecutive frames at a distance frozen to the centimetre.
    if (this.ai) {
      const before = b.state;
      this.ai.step(frame, ctx, this);
      // The AI may have COMMITTED on this very frame. If it did, the body is mid-attack now and
      // must be advanced through its clip, not posed as locomotion — posing it would clear
      // `hitboxActive` on frame 1 of every swing and put a walk cycle on the frame RI-AI02's
      // silhouette check reads.
      if (b.move) { b.advance(frame); return; }
      // The gait the trace reports is the gait the AI is actually using, so a critic reading
      // `speed_mps` sees a walk-in decelerate into a strafe rather than a constant.
      const st = b.state;
      const gait = st === 'RUSH' || st === 'PUNISH_READ' ? 'SPRINT'
        : (b.speedMps > 0.15 ? 'WALK' : 'IDLE');
      b.poseLocomotion(gait, frame);
      if (before !== st && ctx.emit) {
        const e = ctx.emit(frame, 'enemy_state');
        e.eid = b.id; e.from = before; e.to = st; e.channel = 'ai_state';
        e.dist_m = ctx.player
          ? Math.round(Math.hypot(ctx.player.pos[0] - b.pos[0], ctx.player.pos[2] - b.pos[2]) * 1000) / 1000
          : null;
        e.band = ctx.player ? this.ai.band(Math.hypot(ctx.player.pos[0] - b.pos[0], ctx.player.pos[2] - b.pos[2])) : null;
        e.token = this.ai.token;
      }
      return;
    }
    if (this.stat.ai === 'none') { b.state = 'IDLE'; b.poseLocomotion('IDLE', frame); return; }
    const p = ctx.player;
    // ---- PERCEPTION IS NOT OWNED HERE ANY MORE (W1-15 round 2) -------------------------------
    //
    // This block used to be:
    //
    //     const sees = d <= sight_radius_m && facing <= sight_cone_deg / 2;
    //     if (sees || b.aggro) this.alert = Math.min(100, this.alert + 4);
    //     else this.alert = Math.max(0, this.alert - 1);
    //
    // — a flat +4/frame inside a radius and a cone. It read no light, no sound, no line of
    // sight and no Sneak, so `RI-STL01` §2's `V` was computed into the trace 60 times a second
    // and consumed by nothing: an INFANTRY at 8 m reached AGGRO in 0.500 s at V = 0.6669 and in
    // 0.500 s at V = 0.0500. `RI-MTH07` scores that coupling 0.00, and `ARBITRATION` §3's
    // CONSUMPTION check scores a model with coupling 0 exactly as it scores a missing one.
    //
    // The meter is now filled in ONE place — `sim/stealth/system.js::stepPerception()`, through
    // `sim/stealth/perception.js` — and written through to `this.alert` / `this.alertState`
    // there. `RI-STL01` §1 is explicit that the stealth item owns the multipliers on
    // `RI-AI01` §B's fill rates, and two perception implementations is how the round-1 build
    // came to have a good one and a broken one at the same time.
    //
    // What is still owned here, and only this: what the enemy DOES with the meter.
    if (this.alertState === 'AGGRO') { this._steer(p, 240); b.state = 'REPOSITION'; }
    else if (this.alertState === 'SEARCH') { b.state = 'SEARCH'; }
    else b.state = 'IDLE';
    b.poseLocomotion('IDLE', frame);
  }

  /** Called by the resolver when the player's parry window catches this enemy's active frames. */
  becomeParried(frame, frames, emit) {
    this.b.queueParried(frames, frame);
    const e = emit(frame, 'PARRY');
    e.who = this.b.id; e.frames = frames;
    e.riposte_window = this.d.poise.criticals.parry.parried_state.riposte_window;
  }
}

function round1(v) { return Math.round(v * 10) / 10; }
