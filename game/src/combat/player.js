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
    // ---- W1-10 slot dispatch state ----------------------------------------------------------
    this.lib = null;                     // MovesetLibrary, set by CombatSystem.createPlayer
    this.chainFrom = null;               // the slot the last attack ended on (chain successor key)
    this.sprintHeldF = 0;                // consecutive SPRINT frames — RI-WPN04 §B needs >= 24
    this.sprintReleasedAt = -9999;       // + the 8 f@60 grace after release
    this.sprintHeldAtRelease = 0;        // the hold count that earned the grace
    this.twoHandHeldF = 0;               // two_hand HELD frames, for art.1 vs art.2
    this.lastLightPress = -9999;         // guardbreak's "no light press in the last 8 f@60"
    this.chargeHeld = 0;
    this.twoHandPressedAt = -1;
    this.twoHandConsumed = false;
    this.swapLeftPressedAt = -1;
    this.swapLeftConsumed = false;
    this.pendingContextual = null;
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

    // ---- W1-10 per-frame context the slot resolver reads ------------------------------------
    // Held-frame counters and the guard-counter clock. They are counted HERE, once, so that
    // `resolveSlot` is a pure function of an observable state and a critic can reconstruct every
    // one of them from the trace.
    if (b.state === 'SPRINT') { this.sprintHeldF++; this.sprintReleasedAt = -9999; }
    else if (this.sprintHeldF > 0) { this.sprintReleasedAt = frame; this.sprintHeldAtRelease = this.sprintHeldF; this.sprintHeldF = 0; }
    this.twoHandHeldF = (input.held & BIT.two_hand) ? this.twoHandHeldF + 1 : 0;
    if (b.blockSuccessFrame !== undefined && b.blockSuccessFrame > this.lastBlockFrame) {
      this.lastBlockFrame = b.blockSuccessFrame;
    }
    if (frame > this.chainUntil) this.chainFrom = null;

    if (b.dead) { b.poseDead(frame); return; }

    // The RELEASE edge of the chord buttons. See `_tryStart`'s two_hand branch for why the grip
    // changes here rather than on the press.
    if (this.twoHandPressedAt >= 0 && !(input.held & BIT.two_hand)) {
      const consumed = this.twoHandConsumed;
      this.twoHandPressedAt = -1; this.twoHandConsumed = false;
      if (!consumed) this._startLoadoutMove(true, frame, ctx);
    }
    if (this.swapLeftPressedAt >= 0 && !(input.held & BIT.swap_left)) {
      const consumed = this.swapLeftConsumed;
      this.swapLeftPressedAt = -1; this.swapLeftConsumed = false;
      if (!consumed) this._startLoadoutMove(false, frame, ctx);
    }

    // RI-MAG01 §D. If the cast's move is gone — a stagger, a guard break, a death, a parry —
    // the cast was INTERRUPTED, and the Focus is gone with it. This is one branch rather than
    // a hook in every reaction site, so no future reaction can be added that quietly forgets
    // to charge the caster for a spell that never happened.
    if (this.magic && this.magic.cast && (!b.move || b.move.kind !== 'cast')) {
      this.magic.interrupt(frame, b.move ? b.move.kind : 'reaction');
    }

    // RETIRE AT THE TOP OF THE STEP, never at the bottom of the previous one.
    //
    // A move declared `total: 52` must OCCUPY exactly 52 simulated frames and the character
    // must be actionable on the 53rd. Retiring it at the bottom of the step that reached
    // anim_frame 52 makes the character actionable ON frame 52, so every move in the game is
    // observably one frame short of its declared length — a "declared vs observed" mismatch,
    // which HARNESS.md §7 rule 4 calls a hard fail and which RI-CMB01 M1 / RI-CMB02 M1 both
    // measure to +/-0 frames. W1-00 got this right for the same reason and the comment is
    // repeated here because it is the single easiest frame to lose.
    if (b.move && b.animFrame >= b.moveTotal()) {
      const ended = b.move;
      // The cast record lives for exactly `total` frames, retired at the top of the step for
      // the same reason the move is (see the comment below): retiring it a frame early makes
      // every cast in the game observably one frame short of its declared length, which
      // HARNESS §7 rule 4 calls a hard fail and RI-MAG01 M1 measures to +/-0 frames.
      if (ended.kind === 'cast' && this.magic) this.magic.endCast();
      b.endMove();
      if (ended.kind === 'stagger' || ended.kind === 'guard_break') {
        b.regenBlockUntil = Math.max(b.regenBlockUntil, frame + this.d.stamina.regen.delay_frames_after_any_spend);
      }
      if (this.pendingContextual && this.pendingContextual.move === ended) this.pendingContextual = null;
      if (ended.kind === 'attack') {
        this.chainIndex = Math.min(2, this.chainIndex + 1);
        this.chainUntil = frame + 24;
        // The successor a buffered `light` will reach. RI-WPN01 §B's `chains_to` is the graph and
        // this is the only thing that walks it — "a chain that is implicit in code is
        // unmeasurable", so the slot id is carried explicitly and reported in the trace.
        this.chainFrom = ended.slot || null;
      }
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
      // RI-WPN04 §B rule 1: a press inside the 8 f@60 run-up to a contextual window fires the
      // contextual slot on the window's first frame, not the standing attack after the state.
      const pc = this.pendingContextual;
      if (pc && pc.move === b.move && frame >= pc.fireAt) {
        this.pendingContextual = null;
        this._attack(pc.bit, frame, input, ctx, { buffered: true });
      }
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
        this._chargeTick(frame, input, ctx);
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
      } else if (m.kind === 'cast') {
        this._castTick(frame, input, ctx);
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
    // ---- W1-10: a contextual attack out of a COMMITTED state ---------------------------------
    //
    // This is the branch that did not exist. A roll, a backstep and a jump are committed moves,
    // so every `light` pressed inside one used to reach the generic "not actionable" path and be
    // dropped or buffered into the standing attack once the state ended. RI-WPN04 §B says those
    // states are exactly where the contextual slots live, and their windows are INSIDE the
    // enclosing animation. The press is therefore resolved against the enclosing state, and
    // `resolveSlot` — not this function — decides whether the window is open.
    //
    // Nothing is relaxed by this: outside the window `resolveSlot` returns null, and the press is
    // buffered only if the window opens within 8 f@60 (rule 1) and DROPPED otherwise (rule 2).
    // An attack is still uninterruptible by an attack: `m.kind === 'attack'` is not in this list.
    if ((m.kind === 'roll' || m.kind === 'backstep' || m.kind === 'jump')
        && (bit === BIT.light || bit === BIT.heavy)) {
      this._attack(bit, frame, input, ctx, {});
      return;
    }
    // RI-MAG01 §C: a cast is hard-committed through startup, through active, AND through the
    // first ceil(0.60 × recovery) frames of recovery — HARSHER than RI-CMB02 §D's 0.45 for a
    // weapon, deliberately, because the caster is already spending the fight at range with the
    // spacing advantage and the recovery tail is what the range costs. After `hard_until` the
    // ONLY thing that may interrupt it is a dodge. Nothing else, at any class, ever.
    if (bit === BIT.roll && m.kind === 'cast' && nextFrame > m.hard_until) {
      if (this.magic) this.magic.endCast();
      this._tryStart(bit, frame, input, ctx, { cancelledFrom: m.id, atFrame: nextFrame });
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

    // ---- S25: THE WORLD DENIES ACTIONS, AND IT HAS TO DO IT HERE -----------------------------
    //
    // Round 3 implemented this in `sim/player.js`. `stepPlayer` is exported from that file and
    // IMPORTED BY NOTHING — the live player is this class — so the whole block was dead: the
    // water-band denial of sprint and roll, and, worse, the MIRE STRUGGLE. RI-WLD10 §4 makes
    // MIRED escapable by pressing roll three times at 25 stamina each; with the only
    // implementation on a dead call site, MIRED had no exit at all, and every one of the
    // thirteen S9 walked-reachability legs aborted inside it. `AGENT-PROTOCOL` names this exact
    // failure mode: "the verdict may name a dead call site ... confirm the code you are about to
    // change actually runs."
    //
    // `engine._settleWorld` publishes the world's verdict onto the body every frame as
    // `b.worldDeny`. Read it at the input gate, where a denial is legible, and never as a silent
    // speed reduction — which is S25's own distinction.
    const wd = b.worldDeny;
    if (wd) {
      const name = nameOfBit(bit);
      const mired = wd.mired;
      // `wd.attack` is `Traversal.denies('attack')` (RI-WLD10 §5 R2): W5 for everyone, and now
      // also W4 for a non-amphibious body. This used to be re-derived here as a literal
      // `wd.band === 'W5'`, which quietly dropped R2's second clause — "attacks in W4 for the
      // non-amphibious" — because there was no amphibious flag anywhere for a local copy of the
      // rule to consult. One reader of `denies()` instead of two copies of the rule.
      const denied = mired
        || (bit === BIT.roll && wd.roll)
        || (bit === BIT.sprint && wd.sprint)
        || (wd.attack && bit !== BIT.roll);
      if (denied) {
        const e = emit(frame, 'action_denied_by_water');
        e.button = name; e.band = wd.band || 'W0'; e.mired = !!mired;
        // While MIRED the roll press is not a roll, it is a STRUGGLE. `sim/traversal.js` owns the
        // counter (one per 30 f, 25 stamina, three of them break you out); this only reports the
        // press, and it is the ONLY thing in the running build that does.
        if (mired && bit === BIT.roll) { b.mireStruggle = true; e.struggle = true; }
        return;
      }
    }

    // RI-MAG02 §F3 — AIRBORNE IS DEFENCELESS, and it is defenceless here, at the input gate,
    // rather than in a comment. The wave-1 verdict measured `roll` -> BACKSTEP, `block` ->
    // BACKSTEP and `parry` -> PARRY_ACTIVE while levitating, plus `iframe: true`. The list is
    // read from `cast-classes.json §levitation.airborne_denies`, so the data file that declares
    // the rule is the data file that enforces it, and `airborne_permits_cast` is the one hole:
    // slowfall is what you reach for when the flight runs out over a drop.
    if (this.magic && this.magic.levitating) {
      const denies = this.magic.lev.airborne_denies || [];
      const name = nameOfBit(bit);
      const castingIsAllowed = (bit === BIT.light || bit === BIT.heavy) && this.magic.hasCatalyst
        && this.magic.attuned.some((id) => {
          const s = this.magic.spellOf(id);
          return s && s.effects.some((e) => (this.magic.lev.airborne_permits_cast || []).includes(e.effect));
        });
      if (denies.includes(name) && !castingIsAllowed) {
        input.droppedInputs++;
        const e = emit(frame, 'INPUT_DROPPED');
        e.button = name; e.reason = 'levitating_airborne'; e.altitude_m = Math.round(this.magic.altitude * 100) / 100;
        e.permits_cast = this.magic.lev.airborne_permits_cast || [];
        return;
      }
    }

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

    // Seam S19 / RI-MAG01 §C: casting is the `light` button (quick cast) and the `heavy` button
    // (the spell's heavy variant) WITH A CATALYST EQUIPPED IN THE RIGHT HAND — exactly the Souls
    // mapping, and it needs no new verb. With no catalyst in hand these are a sword swing and
    // nothing about the weapon path changes.
    if ((bit === BIT.light || bit === BIT.heavy) && this.magic && this.magic.hasCatalyst) {
      this._tryCast(bit, frame, input, ctx);
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
      return this._attack(bit, frame, input, ctx, opts);
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

    // ---- the two_hand / swap_left CHORD ------------------------------------------------------
    //
    // `game/data/weapons/input-map.json` is explicit and machine-readable about this: `art.1` is
    // the chord "two_hand HELD + heavy tap", `art.2` is "two_hand held + heavy held >= 12 f@60",
    // and `off.r1.*` is "swap_left held + light tap". A button that starts a 36 f@60 committed
    // stance switch on the PRESS can never be the held half of a chord — the weapon art was
    // structurally unreachable, which is one of the two `art.*` slots every one of the 87
    // movesets declares. So the grip changes on the RELEASE, and only if nothing consumed the
    // hold. Nothing about RI-WPN06 §A's commitment is relaxed: the 36 frames still run
    // uncancellable, they simply start one frame after the button comes up.
    if (bit === BIT.two_hand) { this.twoHandPressedAt = frame; this.twoHandConsumed = false; return; }
    if (bit === BIT.swap_left) { this.swapLeftPressedAt = frame; this.swapLeftConsumed = false; return; }

    if (bit === BIT.swap_right) {
      const stance = false;
      const m = b.moves.swap;
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
      b.pendingLoadout = { cycle: 'right' };
      const e = emit(frame, 'ACTION_START');
      e.mv = stance ? 'STANCE_SWITCH' : 'SWAP'; e.tag = stance ? 'stance' : 'swap';
      e.total = m.total; e.to = stance ? (b.twoHanded ? 'one_hand' : 'two_hand') : e.mv;
      e.stam_after = round1(b.stamina);
      return;
    }

    // RI-MAG01 §C: the ONLY new verb magic asks for. It rotates among already-attuned spells,
    // costs nothing, and exists so that nobody ever builds a spell wheel that pauses the fight.
    if (bit === BIT.spell_cycle) {
      if (!this.magic || this.magic.attuned.length < 2) { const e = emit(frame, 'INPUT_DROPPED'); e.button = 'spell_cycle'; e.reason = 'nothing_to_cycle'; return; }
      const a = this.magic.attuned;
      a.push(a.shift());
      const e = emit(frame, 'SPELL_CYCLE');
      e.spell = a[0]; e.attuned = a.slice(); e.stamina_cost = 0; e.focus_cost = 0;
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

  /**
   * Start the 36 f@60 stance switch (or the quick swap) on the button's RELEASE.
   * RI-WPN06 §A: legal from IDLE / WALK / RUN only, uncancellable, and the grip changes when the
   * animation ENDS — committing on the press would make the switch free, which §A hard-fails.
   */
  _startLoadoutMove(stance, frame, ctx) {
    const b = this.b;
    const emit = ctx.emit;
    if (b.move) {
      const e = emit(frame, 'INPUT_DROPPED');
      e.button = stance ? 'two_hand' : 'swap_left'; e.reason = 'illegal_from_state'; e.state = b.state;
      return;
    }
    const m = stance ? b.moves.stance_switch : b.moves.swap;
    if (!m) return;
    if (m.legal_from && m.legal_from.indexOf(b.state) < 0) {
      const e = emit(frame, 'INPUT_DROPPED');
      e.button = stance ? 'two_hand' : 'swap_left'; e.reason = 'illegal_from_state'; e.state = b.state;
      e.legal_from = m.legal_from;
      return;
    }
    if (stance && !b.moves._hasTwoHanded) {
      const e = emit(frame, 'INPUT_DROPPED'); e.button = 'two_hand'; e.reason = 'no_two_handed_moveset';
      return;
    }
    b.begin(m, frame, {});
    b.pendingLoadout = stance ? { twoHanded: !b.twoHanded } : { cycle: 'left' };
    const e = emit(frame, 'ACTION_START');
    e.mv = stance ? 'STANCE_SWITCH' : 'SWAP'; e.tag = stance ? 'stance' : 'swap';
    e.total = m.total; e.to = stance ? (b.twoHanded ? 'one_hand' : 'two_hand') : 'SWAP';
    e.stam_after = round1(b.stamina);
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

  /**
   * RI-MAG01 §B's drop rules and §D's charge rule, in the order they are written there.
   * Every failure DROPS the input — no partial cast, no debt, no queue, and it does not fire
   * later. That is RI-CMB01 rule 7's idiom and casting gets no exemption from it.
   */
  _tryCast(bit, frame, input, ctx) {
    const b = this.b, M = this.magic, emit = ctx.emit;
    const spellId = M.attuned[0];
    if (!spellId) { const e = emit(frame, 'INPUT_DROPPED'); e.button = 'cast'; e.reason = 'nothing_attuned'; return; }
    const reason = M.castDropReason(spellId, b.stamina);
    if (reason) {
      M.stats.drops++;
      const e = emit(frame, 'INPUT_DROPPED');
      e.button = 'cast'; e.reason = reason; e.spell = spellId;
      if (reason === 'no_focus') { e.have = M.focus; e.need = M.costOf(M.spellOf(spellId)); }
      if (reason === 'no_stamina') { e.have = round1(b.stamina); e.need = M.classes[M.spellOf(spellId).class].stamina; }
      // S29: the refusal is spoken, not silent. A traveller who presses cast in a fight is told
      // why, and a critic reading the trace can see that a fence closed rather than a spell
      // failing — which is the difference between a rule and a bug.
      if (reason === 'travel_in_combat' && M._lastTravelRefusal) {
        const t = M._lastTravelRefusal;
        e.fence = t.reason; e.text = t.text;
        if (t.frames_remaining !== undefined) e.frames_remaining = t.frames_remaining;
        const te = emit(frame, 'travel_refused');
        te.spell = spellId; te.fence = t.reason; te.text = t.text; te.ruling = 'S29';
        if (t.frames_remaining !== undefined) { te.frames_remaining = t.frames_remaining; te.cooldown_f = t.cooldown_f; }
      }
      this.dropReason = reason;
      return;
    }
    const m = M.moveFor(spellId);
    b.begin(m, frame, { dirDeg: this._stickBearing(input, ctx) === null ? b.yaw : this._stickBearing(input, ctx) });
    // BOTH resources, on frame 1. Stamina goes through the same `spend()` every swing uses, so
    // it re-arms RI-CMB03 §A's 42-frame regen delay — the assertion RI-MAG01 M2 exists for, and
    // the single thing that stops "cast, roll, cast" being the correct play forever.
    if (m.stamina) b.spend(m.stamina, frame, this.d);
    const cast = M.beginCast(frame, spellId, b.yaw, 0);
    const e = emit(frame, 'ACTION_START');
    e.mv = 'CAST'; e.tag = 'cast'; e.spell = spellId; e.cast_class = m.cast_class;
    e.startup = m.startup; e.active = m.active; e.recovery = m.recovery; e.total = m.total;
    e.Ps = m.startup + 1; e.tc = m.tc_frame; e.hard_until = m.hard_until;
    e.focus_spent = cast.focusSpent; e.focus_after = M.focus;
    e.stam_after = round1(b.stamina);
    if (m.hyperarmour_window) e.ha_window = m.hyperarmour_window;
  }

  /** One frame of a committed cast: aim until Tc, release on startup+1, nothing else. */
  _castTick(frame, input, ctx) {
    const b = this.b, m = b.move, M = this.magic;
    if (!M || !M.cast) return;
    const nf = b.animFrame + 1;
    // RI-MAG01 §B: a `RITUAL` aborts on ANY movement input and on entering `COMBAT`. (The third
    // cause, damage, arrives through the reaction branch at the top of step().) These three are
    // what make "no recall out of a fight, no intervention as an escape button" TRUE — there is
    // no `can_cast_in_combat: false` flag anywhere in this build to forget to set, and the
    // 150 f@60 startup means nothing hostile ever lets the clock finish.
    if (M.cast.abortable) {
      const moved = Math.hypot(input.moveX, input.moveY) > 1e-6
        || (input.pressed & (BIT.roll | BIT.sprint | BIT.jump)) !== 0
        || (input.held & (BIT.sprint)) !== 0;
      if (moved) { M.abortRitual(frame, 'movement'); b.endMove(); b.actionableAt = frame; return; }
      if (ctx.bodies) {
        for (const t of ctx.bodies) {
          if (t === b || t.dead || t.side === b.side) continue;
          const ec = ctx.enemies && ctx.enemies.get ? ctx.enemies.get(t.id) : null;
          if ((ec && ec.alertState === 'AGGRO') || t.inCombat) {
            M.abortRitual(frame, 'combat'); b.endMove(); b.actionableAt = frame; return;
          }
        }
      }
    }
    if (nf <= m.tc_frame) {
      // Before Tc the aim may move, capped at 120 deg/s with a 100 deg budget — the IDENTICAL
      // ceiling RI-AI02 §C gives a boss's standard move. The player must predict a rolling boss
      // exactly as the boss must predict a rolling player.
      const want = ctx.lockedBody
        ? bearingDeg(ctx.lockedBody.pos[0] - b.pos[0], ctx.lockedBody.pos[2] - b.pos[2])
        : ctx.cameraYawDeg;
      M.updateAim(nf, want);
      b.yaw = M.cast.aimYaw;
    } else if (!M.cast.latched) {
      M.cast.latched = true;
    }
    if (nf === m.startup + 1 && !M.cast.released) {
      const socket = [b.pos[0], b.pos[1] + 1.30, b.pos[2]];
      M.release(frame, socket);
    }
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

  // ---- THE slot dispatch --------------------------------------------------------------------
  //
  // W1-10, and the single reason this piece exists. What used to be here was
  // `_contextualVariant()`: it took the standing light attack and MULTIPLIED its frame counts by
  // a modifier row, so a rolling attack was `r1.1` with different numbers and the same clip. That
  // is RI-WPN04's named fake — "a contextual slot that is wired up, appears in the data, appears
  // in the menus, and silently plays the standard light attack" — and it is deleted.
  //
  // Every attack button now goes through `MovesetLibrary.resolveSlot()`, which returns a SLOT ID
  // or NULL. If it returns null the input is DROPPED (or buffered, inside the 8 f@60 window) and
  // loudly reported with the reason. There is no branch anywhere below that reaches `r1.1`
  // because a window was missed — RI-WPN04 §B rule 2.

  /** The RI-WPN04 §B state a button press is being resolved against, and the frame inside it. */
  _slotCtx(frame, input, ctx, opts) {
    const b = this.b;
    const m = b.move;
    const W = this.lib ? this.lib.classes.contextual_windows : null;
    const tier = this.tier();
    const nf = m ? b.animFrame + 1 : 0;
    let state = 'IDLE';
    let stateFrame = 0;
    let descending = false;
    let fall = 0;
    if (m && m.kind === 'roll') { state = 'ROLL'; stateFrame = nf; }
    else if (m && m.kind === 'backstep') { state = 'BACKSTEP'; stateFrame = nf; }
    else if (m && m.kind === 'jump') {
      state = 'AIRBORNE'; stateFrame = nf;
      descending = nf >= m.attack_from;
      fall = descending ? m.apex_m * Math.min(1, (nf - m.attack_from) / Math.max(1, m.active / 2)) : 0;
    } else if (m && m.kind === 'attack') { state = 'ATTACK_RECOVERY'; stateFrame = nf; }
    else if (W && frame - this.lastBlockFrame <= W.guard_counter_f) {
      state = 'BLOCK_SUCCESS'; stateFrame = frame - this.lastBlockFrame;
    } else if (b.state === 'SPRINT' || (this.sprintReleasedAt >= 0 && frame - this.sprintReleasedAt <= (W ? W.sprint_grace_f : 8))) {
      // RI-WPN04 §B: "held >= 24 consecutive f@60, PLUS an 8 f@60 grace after sprint release".
      // Inside the grace the running attack is still the one you get, so the hold count that
      // earned it has to survive the release — resetting it made the grace unreachable.
      state = 'SPRINT';
      stateFrame = b.state === 'SPRINT' ? this.sprintHeldF : this.sprintHeldAtRelease;
    } else if (b.guardRaised) { state = 'BLOCK_HOLD'; }
    // A chain link is reached by a press BUFFERED in the previous link's recovery, so by the time
    // it is resolved the previous move has already retired. `chainFrom` carries it across that
    // boundary — RI-CMB02 §D forbids acting inside the hard part of recovery, so this is the only
    // route a chain can legally take and the trace shows the successor starting on the frame the
    // predecessor ends.
    let chainFrom = null;
    if (state === 'ATTACK_RECOVERY') chainFrom = m.slot || null;
    else if (state === 'IDLE' && this.chainFrom && frame <= this.chainUntil) { state = 'ATTACK_RECOVERY'; chainFrom = this.chainFrom; }
    const mag = Math.hypot(input.moveX, input.moveY);
    return {
      state,
      state_frame: stateFrame,
      roll_tier: tier,
      stance: b.twoHanded ? 'two_hand' : 'one_hand',
      offhand_shield: !b.twoHanded && !!b.shield,
      blocked_with_shield: !!b.blockSuccessShield,
      extra_slots: b.moves._extraSlots || [],
      descending,
      fall_height_m: fall,
      target_below: this._targetBelow(ctx),
      sprint_held_f: state === 'SPRINT' ? stateFrame : this.sprintHeldF,
      forward_mag: input.moveY > 0 ? mag : 0,
      light_pressed_within_buffer: frame - this.lastLightPress <= 8,
      // The tap/hold discrimination happens in `_chargeTick` `HOLD_DISCRIMINATOR_F` frames after
      // the press, not here: on the press frame a tap and a hold are the same input. So the
      // resolver always names the TAP slot and the runtime promotes it.
      heavy_held: false,
      two_hand_held: (input.held & BIT.two_hand) !== 0,
      off_hand_held: (input.held & BIT.swap_left) !== 0,
      offhand_kind: b.offhandKind || null,
      held_frames: this.twoHandHeldF,
      chain_from: chainFrom,
      chain_frame: stateFrame,
      opts,
    };
  }

  _targetBelow(ctx) {
    for (const t of ctx.bodies || []) {
      if (t === this.b || t.dead || t.side === this.b.side) continue;
      const d = Math.hypot(t.pos[0] - this.b.pos[0], t.pos[2] - this.b.pos[2]);
      if (d <= (this.lib ? this.lib.classes.contextual_windows.plunge_target_radius_m : 2.0)) return true;
    }
    return false;
  }

  /**
   * Resolve one attack press and start the slot it names, or drop the input.
   * `bit` is `light`, `heavy` or `parry`.
   */
  _attack(bit, frame, input, ctx, opts) {
    const b = this.b;
    const emit = ctx.emit;
    const button = bit === BIT.light ? 'light' : bit === BIT.heavy ? 'heavy' : 'parry';

    if (!this.lib || !b.moves._slotIds || !b.moves._slotIds.length) {
      // The seven-class spine path. It survives only so that a build with the weapon data
      // absent still runs; it has no contextual slots and says so rather than faking them.
      const m = b.moves[bit === BIT.light ? 'light' : 'heavy'];
      if (!m || !this._afford(m, frame, m.id, emit)) return;
      b.begin(m, frame, {});
      this._spend(m, frame);
      const e = emit(frame, 'ACTION_START');
      e.mv = bit === BIT.light ? 'R1' : 'R2'; e.tag = 'attack'; e.anim_slot = m.slot || m.id;
      e.startup = m.startup; e.active = m.active; e.recovery = m.recovery; e.total = m.total;
      e.Ps = m.startup + 1; e.stam_after = round1(b.stamina);
      return;
    }

    const sctx = this._slotCtx(frame, input, ctx, opts);
    const r = this.lib.resolveSlot(b.weaponId, button, sctx);
    // `guardbreak` requires NO light press in the previous 8 f@60 (RI-WPN04 §B). The press being
    // resolved right now is not "previous", so the clock is stamped AFTER the resolver has read
    // it — stamping it before made every forward light press look like a repeat and guardbreak
    // structurally unreachable.
    if (bit === BIT.light) this.lastLightPress = frame;
    // The two_hand button is a MODIFIER as well as a verb (input-map.json §art.1: the chord is
    // "two_hand held + heavy tap"). A chord that fired consumes the hold, so releasing the
    // button afterwards must not also switch the grip.
    if (r.slot && /^art\./.test(r.slot)) this.twoHandConsumed = true;
    if (r.slot && /^off\./.test(r.slot)) this.swapLeftConsumed = true;
    if (!r.slot) {
      // RI-WPN04 §B rule 1: a press within 8 f@60 BEFORE a contextual window opens is buffered
      // and fires on the window's first frame. Rule 2: anything earlier is DROPPED, not stored.
      const opensIn = this._framesUntilWindow(sctx, button);
      if (opensIn !== null && opensIn > 0 && opensIn <= (this.lib.classes.contextual_windows.buffer_f || 8)) {
        // The buffered press is held HERE rather than handed to the generic action buffer,
        // because the generic buffer is only drained once the actor is actionable — which is
        // AFTER the enclosing state ends, and would fire the standing `r1.1` instead of the
        // contextual slot. RI-WPN04 §B rule 1 is specific: it "fires the contextual slot on the
        // window's FIRST FRAME". One slot, overwritten by a later press, exactly like the
        // 8 f@60 combo buffer it mirrors (RI-CMB01 §C.6).
        this.pendingContextual = { bit, fireAt: frame + opensIn, swing: b.swingSeq, move: b.move };
        const e = emit(frame, 'INPUT_BUFFERED');
        e.button = button; e.frames_left = opensIn; e.for_state = sctx.state;
        e.window_opens_at_state_frame = sctx.state_frame + opensIn; e.reason = r.reason;
        return;
      }
      input.droppedInputs++;
      const e = emit(frame, 'INPUT_DROPPED');
      e.button = button; e.reason = r.reason; e.state = sctx.state; e.state_frame = sctx.state_frame;
      e.roll_tier = sctx.roll_tier;
      this.dropReason = r.reason;
      return;
    }
    const m = b.moves[r.slot];
    if (!m) {
      input.droppedInputs++;
      const e = emit(frame, 'INPUT_DROPPED');
      e.button = button; e.reason = `slot_not_built:${r.slot}`;
      return;
    }
    if (!this._afford(m, frame, r.slot, emit)) return;
    // A contextual attack out of a committed dodge REPLACES the dodge; it does not queue behind
    // it. The i-frames end where the attack begins, which is what makes the window a decision.
    b.move = null;
    b.begin(m, frame, {});
    this._spend(m, frame);
    this.chainFrom = null;
    const e = emit(frame, 'ACTION_START');
    e.mv = button === 'light' ? 'R1' : button === 'heavy' ? 'R2' : 'PARRY';
    e.tag = 'attack'; e.anim_slot = r.slot; e.anim = m.anim; e.reason = r.reason;
    e.from_state = sctx.state; e.from_state_frame = sctx.state_frame; e.roll_tier = sctx.roll_tier;
    e.stance = sctx.stance;
    e.startup = m.startup; e.active = m.active; e.recovery = m.recovery; e.total = m.total;
    e.Ps = m.startup + 1; e.stam_after = round1(b.stamina);
    e.shape = m.shape; e.arc_sweep_deg = m.arc_sweep_deg; e.chains_to = m.chains_to;
    if (m.hyperarmour_window) e.ha_window = m.hyperarmour_window;
    if (m.charge_max_f) e.charge_max_f = m.charge_max_f;
  }

  /**
   * RI-WPN01 §C, the charge contract. `r2` and `r2.charged` are DIFFERENT SLOTS with different
   * clips, and which one you get is decided by whether you were still holding the button when the
   * windup ran out — the Souls input, and the only one that does not require the game to know the
   * future on the press frame. Once the hold begins the attack cannot be cancelled, only released
   * (rule 2), and over-holding past `charge_max_f` fires at full rather than aborting (rule 3).
   */
  _chargeTick(frame, input, ctx) {
    const b = this.b;
    const m = b.move;
    const nf = b.animFrame + 1;
    if (m.charge_max_f) {
      // Already in a charged slot: count the hold and release early if the button came up.
      const holdStart = m.startup - m.charge_max_f;
      if (nf > holdStart && nf <= m.startup) {
        this.chargeHeld = nf - holdStart;
        if (!(input.held & BIT.heavy)) {
          // Released early: skip the remainder of the hold. The attack still FIRES (rule 2).
          b.animFrame = m.startup;
          const e = ctx.emit(frame, 'CHARGE_RELEASE');
          e.slot = m.slot; e.charge_f = this.chargeHeld; e.charge_max_f = m.charge_max_f;
          e.at_full = this.chargeHeld >= m.charge_max_f;
          e.motion_value = this._chargedMV(m, this.chargeHeld);
        }
      }
      return;
    }
    // ---- the TAP / HOLD discriminator --------------------------------------------------------
    //
    // `r2` vs `r2.charged` and `art.1` vs `art.2` are different SLOTS with different clips, and
    // input-map.json distinguishes them by tap versus hold. On the press frame the two are
    // indistinguishable — a press implies the button is down — so the discrimination happens
    // `HOLD_DISCRIMINATOR_F` frames later, and the promoted slot then plays its OWN clip from its
    // OWN frame 1, so the declared frames and the observed frames of the slot that actually fired
    // agree exactly. The eight frames are the `RI-CMB01` §C.6 input allowance, which S22 does not
    // rebase because it is a property of human hands, and the twelve are input-map.json's own
    // figure for `art.2`.
    const promote = /(^|\.)r2$/.test(m.slot || '') ? { at: 9, to: (m.slot === '2h.r2' ? '2h.' : '') + 'r2.charged', why: 'r2.charged' }
      : /(^|\.)art\.1$/.test(m.slot || '') ? { at: 13, to: (m.slot === '2h.art.1' ? '2h.' : '') + 'art.2', why: 'art.2' }
        : m.slot === 'bow.draw' ? { at: 9, to: 'bow.aimed', why: 'bow.aimed' }
          : null;
    if (!promote || nf !== promote.at) return;
    // RI-JRN04 §D / M-P4: on an analog trigger the CHARGE is gated at `T_full` (0.85), not at
    // the fire threshold. `chargeIntent` is 1 for every digital control — a key, a mouse
    // button, a touch button — and only a pad ever lowers it, so this changes nothing for a
    // keyboard player and makes `buttons[7].value = 0.5` fire an r2 that never becomes an
    // r2.charged, which is exactly what M-P4 measures.
    if (!(input.held & BIT.heavy) || !(input.chargeIntent === undefined || input.chargeIntent > 0)) return;
    const cm = b.moves[promote.to];
    if (!cm) return;
    const extra = Math.max(0, cm.stamina - m.stamina);
    if (extra && !canAfford(b, extra)) return;
    b.move = null;
    b.begin(cm, frame, {});
    if (extra) b.spend(extra, frame, this.d);
    this.chargeHeld = 0;
    const e = ctx.emit(frame, 'ACTION_START');
    e.mv = 'R2'; e.tag = 'attack'; e.anim_slot = promote.to; e.anim = cm.anim;
    e.reason = promote.why; e.promoted_from = m.slot; e.after_f = promote.at - 1;
    e.startup = cm.startup; e.active = cm.active;
    e.recovery = cm.recovery; e.total = cm.total; e.Ps = cm.startup + 1;
    e.charge_max_f = cm.charge_max_f || 0; e.stam_after = round1(b.stamina);
    if (cm.hyperarmour_window) e.ha_window = cm.hyperarmour_window;
  }

  /** RI-WPN01 §C: a LERP, never a step. */
  _chargedMV(m, c) {
    const r = m.charge_ramp || { motion_value_at_full: 1.3 };
    const t = m.charge_max_f ? Math.min(1, c / m.charge_max_f) : 0;
    return +(m.motion_value * (1 + (r.motion_value_at_full - 1) * t)).toFixed(4);
  }

  /** How many frames until this state's contextual window opens, or null if it is not a window. */
  _framesUntilWindow(sctx, button) {
    const W = this.lib.classes.contextual_windows;
    const win = sctx.state === 'ROLL' ? W.roll[sctx.roll_tier]
      : sctx.state === 'BACKSTEP' ? W.backstep[sctx.roll_tier] : null;
    if (!win) return null;
    return win[0] - sctx.state_frame;
  }

  // ---- locomotion ---------------------------------------------------------------------------

  _locomotion(frame, input, ctx) {
    const b = this.b;
    const C = this.d.stamina;
    const mx = input.moveX, my = input.moveY;
    const mag = Math.hypot(mx, my);
    if (this.magic && this.magic.levitating) return this._levitationLocomotion(frame, input, ctx, mx, my, mag);
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
      // S11's FROSTBITE proc, applied where locomotion actually happens. `moveSpeedMult` is 1
      // for every body that is not frostbitten, so this line is the identity in every run that
      // does not contain the proc — and it is a real consumer, which is what the four unread
      // procs were missing (W1-14 round 3).
      mps *= (b.moveSpeedMult === undefined ? 1 : b.moveSpeedMult);
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

  /**
   * RI-MAG02 §F1 — DRIFT, not locomotion.
   *
   * The wave-1 build routed a levitating character through the ordinary walk/run/sprint ladder
   * and the critic measured **4.96 m/s in state SPRINT** against a 1.45 m/s bar and a measured
   * walk of 3.17 m/s. Flying was strictly faster than walking, which deletes the entire reason
   * §F's four bounds exist: levitation is supposed to be a way *up*, never a way *across*.
   *
   * There is no sprint here, no jog, no guard-walk and no stamina drain, because none of those
   * verbs exists in the air. There is one speed and it is the declared cap, scaled by the
   * stick. The turn is the ordinary bounded turn — a levitating character still cannot snap
   * its facing (RI-CAM02 §C) — and the state is its own, so a trace can see it.
   */
  _levitationLocomotion(frame, input, ctx, mx, my, mag) {
    const b = this.b;
    const M = this.magic;
    const cap = M.lev.horizontal_drift_mps;
    b.guardRaised = false;
    b.iframe = false;
    b.iframeKind = null;
    if (mag > (this.d.locomotion.move_deadzone || 0)) {
      const dir = this.lock.resolveDirection(b, ctx.lockedBody, mx, my, ctx.cameraYawDeg, false);
      const mps = cap * Math.min(1, mag);
      const per = mps / 60;
      b.pos[0] += Math.sin(dir.dirDeg / DEG) * per;
      b.pos[2] += Math.cos(dir.dirDeg / DEG) * per;
      b.speedMps = mps;
      b.moveDirDeg = dir.dirDeg;
      let dd = angleDelta(b.yaw, dir.facingDeg);
      const maxTurn = (this.d.locomotion.turn_rate_stationary_dps || 480) / 60;
      if (dd > maxTurn) dd = maxTurn; else if (dd < -maxTurn) dd = -maxTurn;
      b.yaw = norm360(b.yaw + dd);
    } else {
      b.speedMps = 0;
    }
    M.drift.mps = b.speedMps;
    M.drift.capMps = cap;
    b.state = 'AIRBORNE';
    b.airborne = true;
    b.poseLocomotion('IDLE', frame);
    b.anim = 'levitate';
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
    // S11's POISONED proc: rot stops you healing. A flask drunk under it is spent and does
    // nothing, which is the cost that makes POISONED a different verb from BURNING.
    if (b.healBlockedUntil && frame < b.healBlockedUntil) {
      if (nf === m.heal_active[1]) {
        const e = emit(frame, 'ESTUS_DONE');
        e.healed = 0; e.hp = Math.round(b.hp); e.left = this.estus; e.blocked_by = 'POISONED';
      }
      return;
    }
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
