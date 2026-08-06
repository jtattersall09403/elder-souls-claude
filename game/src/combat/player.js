// The player's combat state machine.
//
// RI-CMB04 §A steps 1 and 2 live here; steps 3–7 are CombatBody.advance(); steps 8–9 are
// resolve.js; step 10 is trace.js. The order is fixed and the guard in core/guards.js is armed
// across all of it.
//
// The two rules that shape every branch below:
//
//   RI-CMB02 §D — an attack is a CONTRACT THE PLAYER SIGNS. On the frame the button goes down
//   the next 42 to 252 frames are decided. Startup and active are hard-committed; the first
//   ceil(0.45 * recovery) frames of recovery are hard; the rest is DODGE-cancellable and
//   nothing else. There is no block-cancel, ever.
//
//   RI-CMB11 §2 — press to anim_frame == 1 is EXACTLY ZERO additional simulation frames. The
//   input is resolved BEFORE the state advances within the step, so the press and the first
//   frame of the animation are the same line of the trace.
'use strict';

import { BIT } from '../input/actions.js';
import { equipTier } from './moves.js';
import { canAfford } from './rules.js';
import { angleDelta, norm360, bearingDeg } from './geometry.js';
import { parleyAvailable, resolveParley, applyAccept } from './parley.js';
import { criticalAvailable } from './resolve.js';

const DEG = 180 / Math.PI;

export class PlayerController {
  constructor(body, data, lock) {
    this.b = body;
    this.d = data;                       // {roll, frames, stamina, poise, flask, lockon, parley}
    this.lock = lock;
    this.chainIndex = 0;                 // 0 = none, 1 = hit2 available, 2 = hit3 available
    this.chainUntil = -1;
    this.lastBlockFrame = -9999;
    this.estus = data.flask.charges.at_game_start;
    this.flaskLevel = 0;
    this.healBanked = 0;
    this._derived = new Map();
    this.dropReason = null;
    // RI-CAM02 §C's turn-in-place clip, owned by W1-06.
    this.turnInPlace = 0;
    this.turnInPlaceStep = 0;
    this.turnInPlaceAnim = null;
    this.turnInPlaceActive = false;
  }

  tier() { return equipTier(this.b.equipLoadPct, this.d.roll.tier_boundaries_pct); }

  /**
   * One step. `ctx` carries the camera yaw, the locked body, the world state the parley reads,
   * and the event emitter.
   */
  step(frame, input, ctx) {
    const b = this.b;
    const emit = ctx.emit;
    b.tier = this.tier();

    if (b.dead) { b.poseDead(frame); return; }

    // RETIRE AT THE TOP OF THE STEP, never at the bottom of the previous one.
    //
    // A move declared `total: 52` must OCCUPY exactly 52 simulated frames and the character
    // must be actionable on the 53rd. Retiring it at the bottom of the step that reached
    // anim_frame 52 makes the character actionable ON frame 52, so every move in the game is
    // observably one frame short of its declared length — a "declared vs observed" mismatch,
    // which HARNESS.md §7 rule 4 calls a hard fail and which RI-CMB01 M1 / RI-CMB02 M1 both
    // measure to +/-0 frames. W1-00 got this right for the same reason and the comment is
    // repeated here because it is the single easiest frame to lose.
    if (b.move && b.animFrame >= b.move.total) {
      const ended = b.move;
      b.endMove();
      if (ended.kind === 'stagger' || ended.kind === 'guard_break') {
        b.regenBlockUntil = Math.max(b.regenBlockUntil, frame + this.d.stamina.regen.delay_frames_after_any_spend);
      }
      if (ended.kind === 'attack') { this.chainIndex = Math.min(2, this.chainIndex + 1); this.chainUntil = frame + 24; }
      // RI-WPN06 §A: the grip changes when the 36 f@60 animation ENDS, not when it starts.
      // Committing on the press would make the switch free, which is the hard fail §A names.
      if (ended.kind === 'stance' || ended.kind === 'swap') this._commitLoadout(frame, ended, ctx);
    }

    // Reaction states own the actor completely — RI-CMB05 §B "no input is accepted".
    if (b.move && (b.move.kind === 'stagger' || b.move.kind === 'guard_break')) {
      b.advance(frame);
      const x = b.tickResources(frame, this.d);
      if (x) emitExhaust(emit, frame, b, x);
      return;
    }
    if (frame < b.parriedUntil) {
      b.state = 'STAGGER'; b.animFrame++;
      b.poseLocomotion('IDLE', frame);
      b.tickResources(frame, this.d);
      return;
    }

    // ---- step 1/2: resolve input against the current state --------------------------------
    const pressed = input.pressed;
    const held = input.held;
    const committed = b.move !== null;

    if (committed) {
      this._inputDuringCommitment(frame, input, pressed, ctx);
    } else {
      const bit = pressed ? firstActionBit(pressed) : (input.takeBuffered ? input.takeBuffered() : 0);
      const chosen = bit || (input.bufferedAction && frame >= b.actionableAt ? input.takeBuffered() : 0);
      if (chosen) this._tryStart(chosen, frame, input, ctx);
    }

    // ---- step 3..7 -------------------------------------------------------------------------
    if (b.move) {
      const m = b.move;
      // soft-lock steering, before the pose is evaluated (RI-CMB06 §D)
      if (m.kind === 'attack') {
        const tgt = ctx.lockedBody || this._softLockTarget(ctx);
        this.lock.steerDuringAttack(b, tgt, b.animFrame + 1, m.startup);
      } else if (m.kind === 'roll' || m.kind === 'backstep') {
        // RI-CMB09 §2: yaw is LOCKED through HARD, may turn at 240 deg/s through TURN.
        const nf = b.animFrame + 1;
        const recStart = m.iframes ? m.iframes[1] + 1 : m.startup + 1;
        if (nf > m.hard_until && nf > recStart) {
          const want = ctx.lockedBody
            ? bearingDeg(ctx.lockedBody.pos[0] - b.pos[0], ctx.lockedBody.pos[2] - b.pos[2])
            : this._stickBearing(input, ctx);
          if (want !== null) {
            const maxStep = m.turn_rate_dps / 60;
            let dd = angleDelta(b.yaw, want);
            if (dd > maxStep) dd = maxStep; else if (dd < -maxStep) dd = -maxStep;
            b.yaw = norm360(b.yaw + dd);
          }
        }
      } else if (m.kind === 'heal') {
        this._healTick(frame, emit);
      } else if (m.kind === 'parley') {
        if (b.animFrame + 1 === m.resolution_frame) this._resolveParley(frame, ctx);
      } else if (m.kind === 'crit') {
        if (b.animFrame + 1 === m.damage_frame) this._critDamage(frame, ctx);
      }
      b.advance(frame);
    } else {
      this._locomotion(frame, input, ctx);
    }

    if (frame > this.chainUntil) this.chainIndex = 0;

    // ---- resources --------------------------------------------------------------------------
    const ex = b.tickResources(frame, this.d);
    if (ex) emitExhaust(emit, frame, b, ex);
  }

  // ---- input while committed -----------------------------------------------------------------

  /**
   * RI-CMB02 §D, the commitment rule, and RI-CMB01 §C.6 / RI-CMB09 §1, the buffer.
   *
   * Three outcomes and no fourth: IGNORED (dropped, loudly), BUFFERED (the last 8 frames only,
   * one slot, a later press overwrites), or CANCELLED (a dodge, and only inside the declared
   * dodge-cancel window of an attack's recovery). A press before `total - 8` is DROPPED, NOT
   * QUEUED — the mash-queue that flushes four rolls on the actionable frame is RI-CMB01
   * "How we lose" #5 and RI-CMB11 D4.
   */
  _inputDuringCommitment(frame, input, pressed, ctx) {
    const b = this.b, m = b.move;
    if (!pressed) return;
    const bit = firstActionBit(pressed);
    if (!bit) return;
    // Input is resolved BEFORE the animation advances (RI-CMB11 D1), so the frame this press
    // lands on is anim_frame + 1 and `framesLeft` counts the frames AFTER it.
    const nextFrame = b.animFrame + 1;
    const framesLeft = m.total - nextFrame;

    // dodge-cancel: attacks only, and only after the hard part of recovery
    if (bit === BIT.roll && m.kind === 'attack' && nextFrame > m.hard_until) {
      this._tryStart(bit, frame, input, ctx, { cancelledFrom: m.id, atFrame: nextFrame });
      return;
    }
    // RI-WPN04 §B: a jump attack is legal from AIRBORNE and vel_y < 0 only — "no rising jump
    // attacks" — and RI-CMB01 §B / RI-CMB02 §C forbid it entirely at OVERLOADED.
    if (m.kind === 'jump' && (bit === BIT.light || bit === BIT.heavy)) {
      if (nextFrame < m.attack_from) {
        input.droppedInputs++;
        const e = ctx.emit(frame, 'INPUT_DROPPED');
        e.button = nameOfBit(bit); e.reason = 'jump_rising'; e.anim_frame = nextFrame;
        e.legal_from = m.attack_from;
        return;
      }
      if (this.tier() === 'OVERLOADED') {
        input.droppedInputs++;
        const e = ctx.emit(frame, 'INPUT_DROPPED');
        e.button = nameOfBit(bit); e.reason = 'overloaded_no_jump_attack';
        return;
      }
      this._tryStart(bit, frame, input, ctx, { jumping: true });
      return;
    }
    // heal has its own dodge-cancel window (RI-CMB08 §C)
    if (bit === BIT.roll && m.kind === 'heal' && nextFrame >= m.dodge_cancel_from) {
      this._tryStart(bit, frame, input, ctx, { cancelledFrom: 'heal' });
      return;
    }
    if (framesLeft < this.d.frames.buffer_frames) {
      input.tryBuffer(bit, frame, framesLeft);
      const e = ctx.emit(frame, 'INPUT_BUFFERED');
      e.button = nameOfBit(bit); e.frames_left = framesLeft;
    } else {
      input.droppedInputs++;
      const e = ctx.emit(frame, 'INPUT_DROPPED');
      e.button = nameOfBit(bit); e.reason = 'not_actionable'; e.frames_left = framesLeft;
    }
  }

  // ---- starting an action -----------------------------------------------------------------

  _tryStart(bit, frame, input, ctx, opts) {
    const b = this.b;
    const tier = this.tier();
    const emit = ctx.emit;

    if (bit === BIT.roll) {
      const stickMag = Math.hypot(input.moveX, input.moveY);
      const locked = ctx.lockedBody;
      const dir = this.lock.resolveDirection(b, locked, input.moveX, input.moveY, ctx.cameraYawDeg, true);
      const isBackstep = locked ? stickMag < this.d.lockon.directional.stick_threshold : stickMag < 1e-6;
      const key = `${isBackstep ? 'backstep' : 'roll'}_${tier}`;
      const m = b.moves[key];
      if (!this._afford(m, frame, key, emit)) return;
      b.begin(m, frame, { dirDeg: dir.dirDeg });
      // RI-CMB01 §C.4: direction is LATCHED at frame 1. Under lock the character keeps FACING
      // the target while it rolls sideways — which is exactly what makes a left roll circle.
      b.yaw = locked ? dir.facingDeg : dir.dirDeg;
      b.rollDirDeg = dir.dirDeg;
      this._spend(m, frame);
      const e = emit(frame, 'ACTION_START');
      e.mv = isBackstep ? 'BACKSTEP' : 'ROLL'; e.tag = 'dodge'; e.tier = tier;
      e.dir_deg = round2(dir.dirDeg); e.facing_deg = round2(b.yaw);
      e.iframes = m.iframes; e.total = m.total; e.stam_after = round1(b.stamina);
      if (opts && opts.cancelledFrom) e.cancelled_from = opts.cancelledFrom;
      return;
    }

    if (bit === BIT.light || bit === BIT.heavy) {
      // A critical is a positional attack: it REPLACES the light attack when the geometry and
      // the target's state allow it, on the same input, on the same frame. No chance component.
      if (bit === BIT.light && ctx.bodies) {
        for (const t of ctx.bodies) {
          if (t === b || t.dead || t.yielded || t.side === b.side) continue;
          const kind = criticalAvailable(b, t, this.d, frame);
          if (kind) {
            const m = b.moves[kind];
            if (!this._afford(m, frame, kind, emit)) return;
            b.begin(m, frame, {});
            b.critTargetId = t.id;
            t.beingCritted = true;
            this._spend(m, frame);
            const e = emit(frame, 'ACTION_START');
            e.mv = kind.toUpperCase(); e.tag = 'critical'; e.tgt = t.id;
            e.total = m.total; e.invuln = m.iframes; e.stam_after = round1(b.stamina);
            return;
          }
        }
      }
      const base = b.moves[bit === BIT.light ? 'light' : 'heavy'];
      const m = this._contextualVariant(base, frame, opts);
      if (!this._afford(m, frame, m.id, emit)) return;
      b.begin(m, frame, {});
      this._spend(m, frame);
      const e = emit(frame, 'ACTION_START');
      e.mv = bit === BIT.light ? 'R1' : 'R2'; e.tag = m.tag || 'attack';
      e.startup = m.startup; e.active = m.active; e.recovery = m.recovery; e.total = m.total;
      e.Ps = m.startup + 1; e.stam_after = round1(b.stamina);
      if (m.hyperarmour_window) e.ha_window = m.hyperarmour_window;
      return;
    }

    if (bit === BIT.parry) {
      // RI-WPN06 §A: two-handed, the offhand item is STOWED and `block`, `parry` and `off.*`
      // are unavailable for the whole duration. That is the cost that makes the grip a choice.
      if (b.twoHanded) { const e = emit(frame, 'INPUT_DROPPED'); e.button = 'parry'; e.reason = 'two_handed_offhand_stowed'; return; }
      const m = b.moves.parry;
      if (!m) { const e = emit(frame, 'INPUT_DROPPED'); e.button = 'parry'; e.reason = 'no_parry_tool'; return; }
      if (!this._afford(m, frame, 'parry', emit)) return;
      b.begin(m, frame, {});
      this._spend(m, frame);
      const e = emit(frame, 'ACTION_START');
      e.mv = 'PARRY'; e.tag = 'parry'; e.window = m.parry_window; e.total = m.total; e.stam_after = round1(b.stamina);
      return;
    }

    if (bit === BIT.use_item) {
      const m = b.moves.heal;
      if (this.estus <= 0) { const e = emit(frame, 'INPUT_DROPPED'); e.button = 'heal'; e.reason = 'no_charges'; return; }
      b.begin(m, frame, {});
      this.estus--;
      this.healBanked = 0;
      b.regenBlockUntil = frame + this.d.stamina.regen.delay_frames_after_any_spend;
      const e = emit(frame, 'ESTUS_START');
      e.left = this.estus; e.total = m.total; e.secure_frames = m.heal_secure_frames;
      e.heal_total = Math.round(b.hpMax * (this.d.flask.heal.formula_pct_of_max_hp ? 0.400 + 0.032 * this.flaskLevel : 0.4));
      return;
    }

    if (bit === BIT.jump) {
      const m = b.moves.jump;
      if (!m) return;
      if (b.exhausted) { const e = emit(frame, 'INPUT_DROPPED'); e.button = 'jump'; e.reason = 'exhausted'; return; }
      if (!this._afford(m, frame, 'jump', emit)) return;
      b.begin(m, frame, {});
      this._spend(m, frame);
      const e = emit(frame, 'ACTION_START');
      e.mv = 'JUMP'; e.tag = 'jump'; e.total = m.total; e.apex_m = m.apex_m;
      e.airborne = m.airborne; e.attack_from = m.attack_from; e.tier = tier;
      e.stam_after = round1(b.stamina);
      return;
    }

    if (bit === BIT.two_hand || bit === BIT.swap_right || bit === BIT.swap_left) {
      const stance = bit === BIT.two_hand;
      const m = stance ? b.moves.stance_switch : b.moves.swap;
      if (!m) return;
      // RI-WPN06 §A: legal from IDLE, WALK, RUN only. `_tryStart` is only reached when the
      // actor is uncommitted, so the states that remain to exclude are the guard and the
      // exhausted bar; everything else is already excluded structurally.
      if (m.legal_from && m.legal_from.indexOf(b.state) < 0) {
        const e = emit(frame, 'INPUT_DROPPED');
        e.button = nameOfBit(bit); e.reason = 'illegal_from_state'; e.state = b.state;
        e.legal_from = m.legal_from;
        return;
      }
      if (stance && !b.moves._hasTwoHanded) {
        const e = emit(frame, 'INPUT_DROPPED'); e.button = 'two_hand'; e.reason = 'no_two_handed_moveset';
        return;
      }
      b.begin(m, frame, {});
      b.pendingLoadout = stance
        ? { twoHanded: !b.twoHanded }
        : { cycle: bit === BIT.swap_right ? 'right' : 'left' };
      const e = emit(frame, 'ACTION_START');
      e.mv = stance ? 'STANCE_SWITCH' : 'SWAP'; e.tag = stance ? 'stance' : 'swap';
      e.total = m.total; e.to = stance ? (b.twoHanded ? 'one_hand' : 'two_hand') : e.mv;
      e.stam_after = round1(b.stamina);
      return;
    }

    if (bit === BIT.interact) {
      const m = b.moves.parley;
      const tgt = ctx.lockedBody || this._nearestParleyable(ctx);
      const av = parleyAvailable(b, tgt, m, frame);
      if (!av.ok) {
        const e = emit(frame, tgt && !tgt.parley ? 'PARLEY_EXEMPT' : 'INPUT_DROPPED');
        e.button = 'parley'; e.reason = av.reason; if (tgt) e.tgt = tgt.id;
        return;
      }
      b.begin(m, frame, {});
      b.parleyTargetId = tgt.id;
      const e = emit(frame, 'ACTION_START');
      e.mv = 'PARLEY'; e.tag = 'parley'; e.tgt = tgt.id; e.total = m.total;
      e.resolution_frame = m.resolution_frame; e.stam_after = round1(b.stamina);
      return;
    }
  }

  /** RI-WPN06 §A: the grip (or the item) changes when the committed animation ends. */
  _commitLoadout(frame, ended, ctx) {
    const b = this.b;
    const p = b.pendingLoadout;
    b.pendingLoadout = null;
    if (!p || !ctx.rebuildLoadout) return;
    const r = ctx.rebuildLoadout(p);
    if (!r) return;
    const e = ctx.emit(frame, 'ACTION_START');
    e.mv = ended.kind === 'stance' ? 'STANCE_SWITCH' : 'SWAP';
    e.tag = ended.kind === 'stance' ? 'stance_done' : 'swap_done';
    e.total = 0; e.stance = b.twoHanded ? 'two_hand' : 'one_hand';
    e.weapon = b.moves._movesetId; e.shield = b.shieldId;
    this._derived.clear();
  }

  _afford(m, frame, name, emit) {
    if (!m) return false;
    if (canAfford(this.b, m.stamina)) return true;
    // RI-CMB03's construction, and orchestrator ruling R4's: the input is DROPPED. Not queued,
    // no debt, no partial action. > 0 of these in a fight is MANDATORY (RI-CMB03 §E last row).
    this.b.staminaDrops = (this.b.staminaDrops || 0) + 1;
    const e = emit(frame, 'INPUT_DROPPED');
    e.button = name; e.reason = 'no_stamina';
    e.have = round1(this.b.stamina); e.need = m.stamina;
    this.dropReason = 'no_stamina';
    return false;
  }

  _spend(m, frame) {
    if (!m.stamina) return;
    this.b.spend(m.stamina, frame, this.d);
  }

  /**
   * RI-CMB02 §C's contextual attacks, derived from the base row by the item's own multipliers
   * with the item's own rounding rule and the 6 f@60 clamp. Cached per (base, modifier).
   */
  _contextualVariant(base, frame, opts) {
    const b = this.b;
    let mod = null, tag = null;
    if (opts && opts.cancelledFrom) { /* attack out of a cancel is a plain attack */ }
    if (opts && opts.jumping) { mod = 'jump'; tag = 'jump'; }
    else if (b.state === 'ROLL_RECOVER' || (opts && opts.rolling)) { mod = 'rolling'; tag = 'rolling'; }
    else if (b.state === 'SPRINT') { mod = 'running'; tag = 'running'; }
    else if (frame - this.lastBlockFrame <= this.d.frames.modifiers.guard_counter.window_after_block_f) { mod = 'guard_counter'; tag = 'guard_counter'; }
    else if (base.id === 'light' && this.chainIndex === 1) { mod = 'chain_hit_2'; tag = 'chain2'; }
    else if (base.id === 'light' && this.chainIndex === 2) { mod = 'chain_hit_3'; tag = 'chain3'; }
    if (!mod) return base;
    const key = `${base.anim}:${mod}`;
    if (this._derived.has(key)) return this._derived.get(key);
    const M = this.d.frames.modifiers[mod];
    const FLOOR = this.d.frames.min_startup_frames;
    const startup = Math.max(FLOOR, Math.round(base.startup * (M.startup || 1)));
    const active = Math.round(base.active * (M.active || 1));
    const recovery = Math.round(base.recovery * (M.recovery || 1));
    const v = Object.assign({}, base, {
      id: `${base.id}_${mod}`,
      tag,
      startup, active, recovery,
      total: startup + active + recovery,
      Ps: startup + 1,
      stamina: Math.round(base.stamina * (M.stamina || 1)),
      motion_value: +(base.motion_value * (M.motion_value || 1)).toFixed(4),
      poise_damage: Math.round(base.poise_damage * (M.poise_damage || 1)),
      root_dz_m: base.root_dz_m * (M.root_dz_mult || 1),
      hard_until: startup + active + Math.ceil(0.45 * recovery),
      clamped: startup === FLOOR && Math.round(base.startup * (M.startup || 1)) < FLOOR,
      modifier: mod,
    });
    v.clip = new base.clip.constructor(`${base.anim}_${mod}`, base.clip.arch,
      { startup, active, total: v.total }, base.clip.amplitude, v.root_dz_m);
    this._derived.set(key, v);
    return v;
  }

  // ---- locomotion ---------------------------------------------------------------------------

  _locomotion(frame, input, ctx) {
    const b = this.b;
    const C = this.d.stamina;
    const mx = input.moveX, my = input.moveY;
    const mag = Math.hypot(mx, my);
    const wantGuard = (input.held & BIT.block) !== 0;
    // RI-CAM02 §C classifies "stationary" from the speed the character ALREADY HAS, not the
    // one it is about to be given, so the previous frame's value is latched here.
    const prevSpeed = b.speedMps;

    // RI-CMB09 §4: at zero stamina the guard may STAY up but may not be RAISED.
    // RI-WPN06 §A: two-handed, the offhand is stowed and there is nothing to raise.
    if (wantGuard && !b.guardRaised && b.twoHanded) {
      const e = ctx.emit(frame, 'INPUT_DROPPED'); e.button = 'block'; e.reason = 'two_handed_offhand_stowed';
    } else if (wantGuard && !b.guardRaised && b.exhausted) {
      const e = ctx.emit(frame, 'INPUT_DROPPED'); e.button = 'block'; e.reason = 'exhausted';
    } else {
      if (wantGuard && !b.guardRaised) { const e = ctx.emit(frame, 'GUARD_UP'); e.who = b.id; }
      b.guardRaised = wantGuard;
    }

    let state = 'IDLE';
    // W1-06 / RI-CAM02 §C: the movement stick's deadzone is RADIAL and lives at 0.15. Below
    // it the character is idle; a per-axis deadzone, or none at all, is a named failure.
    if (mag > 0 && mag <= (this.d.locomotion.move_deadzone || 0)) { state = 'IDLE'; b.speedMps = 0; }
    else if (mag > 1e-6) {
      const locked = ctx.lockedBody;
      const dir = this.lock.resolveDirection(b, locked, mx, my, ctx.cameraYawDeg, false);
      // RI-CMB09 §4: EXHAUSTED is walk-only. Sprint is denied and jog is denied.
      const wantSprint = (input.held & BIT.sprint) !== 0 && !b.exhausted && b.stamina > 0;
      let mps;
      if (wantSprint) {
        mps = this.d.locomotion.sprint_mps;
        b.stamina = Math.max(0, b.stamina - C.costs.sprint_per_frame);
        b.regenBlockUntil = frame + C.regen.delay_frames_after_any_spend;
        state = 'SPRINT';
      } else if (b.exhausted) { mps = this.d.locomotion.walk_mps; state = 'WALK'; }
      else if (b.guardRaised) { mps = this.d.locomotion.walk_mps * 1.15; state = 'WALK'; }
      else if (mag > 0.55) { mps = this.d.locomotion.jog_mps; state = 'RUN'; }
      else { mps = this.d.locomotion.walk_mps * (mag / 0.55); state = 'WALK'; }
      mps *= (locked && state !== 'SPRINT') ? dir.speedMult : 1.0;
      const per = mps / 60;
      b.pos[0] += Math.sin(dir.dirDeg / DEG) * per;
      b.pos[2] += Math.cos(dir.dirDeg / DEG) * per;
      b.speedMps = mps;
      b.moveDirDeg = dir.dirDeg;
      // ---- W1-06 / RI-CAM02 §C — THE BOUNDED-TURN LAW ------------------------------------
      // The character's facing is NEVER assigned from the input direction. There are two
      // ceilings and one clip:
      //   moving (speed > 0.5 m/s) ............ ≤ 720 °/s = 12.0 °/frame, a visible arc
      //   stationary, |err| ≤ 100° ............ ≤ 480 °/s =  8.0 °/frame
      //   stationary, |err| >  100° ........... an 18-frame root-motion `turn_in_place`
      // Under lock none of this applies: facing is held on the target and the character
      // strafes, so RI-CAM04 §C's "zero TURN frames while locked" holds structurally.
      const L = this.d.locomotion;
      let dd = angleDelta(b.yaw, dir.facingDeg);
      if (!locked && this.turnInPlace > 0) {
        // Mid-clip: the yaw comes from the clip's root track, not from the rate limiter, and
        // the character does not translate (RI-VIS08 C3 measures the foot slide if it does).
        b.pos[0] -= Math.sin(dir.dirDeg / DEG) * per;
        b.pos[2] -= Math.cos(dir.dirDeg / DEG) * per;
        b.speedMps = 0;
        b.yaw = norm360(b.yaw + this.turnInPlaceStep);
        this.turnInPlace--;
        state = 'IDLE';
        this.turnInPlaceActive = true;
      } else if (!locked && prevSpeed <= 0.5 && Math.abs(dd) > (L.turn_in_place_threshold_deg || 100)) {
        const n = L.turn_in_place_frames || 18;
        this.turnInPlace = n - 1;
        this.turnInPlaceStep = dd / n;
        this.turnInPlaceAnim = dd > 0 ? 'turn_in_place_r' : 'turn_in_place_l';
        this.turnInPlaceActive = true;
        b.pos[0] -= Math.sin(dir.dirDeg / DEG) * per;
        b.pos[2] -= Math.cos(dir.dirDeg / DEG) * per;
        b.speedMps = 0;
        b.yaw = norm360(b.yaw + this.turnInPlaceStep);
        state = 'IDLE';
      } else {
        this.turnInPlaceActive = false;
        const moving = prevSpeed > 0.5;
        const maxTurn = (moving ? (L.turn_rate_moving_dps || 720) : (L.turn_rate_stationary_dps || 480)) / 60;
        if (dd > maxTurn) dd = maxTurn; else if (dd < -maxTurn) dd = -maxTurn;
        b.yaw = norm360(b.yaw + dd);
      }
    } else {
      this.turnInPlace = 0;
      this.turnInPlaceActive = false;
      b.speedMps = 0;
      if (ctx.lockedBody) {
        const want = bearingDeg(ctx.lockedBody.pos[0] - b.pos[0], ctx.lockedBody.pos[2] - b.pos[2]);
        const maxTurn = this.d.locomotion.turn_rate_dps / 60;
        let dd = angleDelta(b.yaw, want);
        if (dd > maxTurn) dd = maxTurn; else if (dd < -maxTurn) dd = -maxTurn;
        b.yaw = norm360(b.yaw + dd);
      }
      state = b.guardRaised ? 'BLOCK_HOLD' : 'IDLE';
    }
    if (b.guardRaised && state === 'IDLE') state = 'BLOCK_HOLD';
    b.state = state;
    b.poseLocomotion(state === 'BLOCK_HOLD' ? 'IDLE' : state, frame);
    // The turn-in-place clip is named AFTER the pose, because poseLocomotion() owns `anim`
    // for every ordinary gait and this is the one gait it does not know about.
    if (this.turnInPlaceAnim && this.turnInPlace >= 0 && state === 'IDLE' && this.turnInPlaceActive) {
      b.anim = this.turnInPlaceAnim;
    }
  }

  _stickBearing(input, ctx) {
    if (Math.hypot(input.moveX, input.moveY) < 1e-6) return null;
    return norm360(ctx.cameraYawDeg + Math.atan2(input.moveX, input.moveY) * DEG);
  }

  _softLockTarget(ctx) {
    const S = this.d.lockon.soft_lock;
    let best = null, bestAng = S.unlocked_cone_deg;
    for (const t of ctx.bodies || []) {
      if (t === this.b || t.dead || t.yielded || t.side === this.b.side) continue;
      const dx = t.pos[0] - this.b.pos[0], dz = t.pos[2] - this.b.pos[2];
      if (Math.hypot(dx, dz) > S.unlocked_radius_m) continue;
      const a = Math.abs(angleDelta(this.b.yaw, bearingDeg(dx, dz)));
      if (a < bestAng) { bestAng = a; best = t; }
    }
    return best;
  }

  _nearestParleyable(ctx) {
    let best = null, bestD = Infinity;
    for (const t of ctx.bodies || []) {
      if (t === this.b || t.dead || t.side === this.b.side) continue;
      const d = Math.hypot(t.pos[0] - this.b.pos[0], t.pos[2] - this.b.pos[2]);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  // ---- per-move ticks ---------------------------------------------------------------------

  _healTick(frame, emit) {
    const b = this.b, m = b.move;
    const nf = b.animFrame + 1;
    if (nf < m.heal_active[0] || nf > m.heal_active[1]) return;
    const pct = 0.400 + 0.032 * this.flaskLevel;
    const total = b.hpMax * pct;
    const per = total / m.ramp_frames;
    const before = b.hp;
    b.hp = Math.min(b.hpMax, b.hp + per);          // overheal is discarded
    this.healBanked += b.hp - before;
    if (nf === m.heal_active[1]) {
      const e = emit(frame, 'ESTUS_DONE');
      e.healed = Math.round(this.healBanked); e.hp = Math.round(b.hp); e.left = this.estus;
    }
  }

  _critDamage(frame, ctx) {
    const b = this.b, m = b.move;
    const t = (ctx.bodies || []).find((x) => x.id === b.critTargetId);
    if (!t) return;
    const dmg = b.moves._weapon.attack_rating * m.crit_multiplier * 3.0;
    t.hp -= dmg;
    t.beingCritted = false;
    const e = ctx.emit(frame, 'CRIT_HIT');
    e.src = b.id; e.dst = t.id; e.kind = m.id; e.dmg = Math.round(dmg);
    e.hp_after = Math.round(Math.max(0, t.hp)); e.crit_multiplier = m.crit_multiplier;
    if (t.hp <= 0) {
      t.hp = 0; t.dead = true; t.state = 'DEAD'; t.move = null; t.animFrame = 0;
      const d = ctx.emit(frame, 'DEATH'); d.who = t.id; d.by = b.id;
    } else {
      const g = ctx.emit(frame, 'CRIT_RELEASE');
      g.who = t.id; g.getup_f = this.d.poise.criticals.backstab.target_release.getup_f;
      g.getup_iframes_f = this.d.poise.criticals.backstab.target_release.getup_iframes_f;
    }
  }

  _resolveParley(frame, ctx) {
    const b = this.b;
    const t = (ctx.bodies || []).find((x) => x.id === b.parleyTargetId);
    if (!t) return;
    const r = resolveParley(b, t, ctx.world, this.d.parley);
    if (r.accepted) {
      const out = applyAccept(t, r.ground, ctx.world, r.detail);
      const e = ctx.emit(frame, 'PARLEY_ACCEPT');
      e.src = b.id; e.tgt = t.id; e.ground = r.ground; e.tried = r.tried;
      e.detail = r.detail; e.faction_delta = out.faction_delta; e.gold_spent = out.gold_spent;
      e.souls_awarded = 0;
      e.note = 'the fight is resolved without a corpse — ARBITRATION §1: killing is ONE exit from a fight, not the only one';
    } else {
      t.parleyRefusedUntil = frame + b.move.refuse_cooldown_f;
      t.aggro = true;
      const e = ctx.emit(frame, 'PARLEY_REFUSE');
      e.src = b.id; e.tgt = t.id; e.tried = r.tried; e.detail = r.detail;
      e.cooldown_f = b.move.refuse_cooldown_f;
    }
  }
}

function emitExhaust(emit, frame, b, kind) {
  if (!kind) return;
  const e = emit(frame, kind === 'enter' ? 'EXHAUSTED_ENTER' : 'EXHAUSTED_EXIT');
  e.who = b.id; e.stamina = round1(b.stamina);
  if (kind === 'enter') { e.poise_mult = 0.5; e.locomotion = ['walk']; }
}

/** Roll wins over attack on the same frame: it is the REACTIVE action (RI-CMB01). */
function firstActionBit(mask) {
  if (mask & BIT.roll) return BIT.roll;
  if (mask & BIT.parry) return BIT.parry;
  if (mask & BIT.use_item) return BIT.use_item;
  if (mask & BIT.interact) return BIT.interact;
  if (mask & BIT.jump) return BIT.jump;
  if (mask & BIT.heavy) return BIT.heavy;
  if (mask & BIT.light) return BIT.light;
  // The loadout buttons resolve LAST: a stance switch or a swap must never win a frame from a
  // dodge or an attack. RI-WPN06 §A makes them legal only from IDLE/WALK/RUN anyway.
  if (mask & BIT.two_hand) return BIT.two_hand;
  if (mask & BIT.swap_right) return BIT.swap_right;
  if (mask & BIT.swap_left) return BIT.swap_left;
  return 0;
}
function nameOfBit(bit) { for (const k in BIT) if (BIT[k] === bit) return k; return String(bit); }
function round1(v) { return Math.round(v * 10) / 10; }
function round2(v) { return Math.round(v * 100) / 100; }
