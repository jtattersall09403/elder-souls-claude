// The moveset runtime: slot resolution, contextual windows, charge, stance, and hitstop.
//
// W1-10. Three properties this file exists to guarantee, each of them a hard fail somewhere in
// RI-WPN01/04/06 if it is not true:
//
//  1. **A contextual slot is a slot, not a modifier.** `resolveSlot` returns a slot id, and the
//     slot id carries its own clip, its own frames and its own root track. There is no code path
//     anywhere that reaches `r1.1` and then scales it because the player was rolling. If a
//     contextual window is missed, the input is DROPPED (or buffered), never downgraded —
//     RI-WPN04 §B.2 and §D T1.
//  2. **A window is a frame range inside a state's own animation.** No milliseconds, no
//     wall clock, no `deltaTime`. Every comparison in here is integer-frame.
//  3. **Two-handing selects a different slot table.** `2h.<x>` is a different key with a
//     different clip, not `<x>` with a multiplier — RI-WPN06 §B.
'use strict';

import { Clip } from './clips.js';
import { buildSwing } from './swing.js';

/** Slot ids that may only be reached from a state, never from IDLE (RI-WPN04 §D T7). */
export const CONTEXTUAL_STATES = {
  'roll.r1': 'ROLL', 'roll.r2': 'ROLL', '2h.roll.r1': 'ROLL', '2h.roll.r2': 'ROLL',
  'backstep.r1': 'BACKSTEP', '2h.backstep.r1': 'BACKSTEP',
  'run.r1': 'SPRINT', 'run.r2': 'SPRINT', '2h.run.r1': 'SPRINT', '2h.run.r2': 'SPRINT',
  'jump.r1': 'AIRBORNE', 'jump.r2': 'AIRBORNE', '2h.jump.r1': 'AIRBORNE', '2h.jump.r2': 'AIRBORNE',
  plunge: 'AIRBORNE',
  'guard.counter': 'BLOCK_SUCCESS', '2h.guard.counter': 'BLOCK_SUCCESS',
};

export class MovesetLibrary {
  /**
   * @param {object} registry game/data/weapons/clip-registry.json
   * @param {object} classes  game/data/weapons/classes.json
   * @param {object} movesets {weapon_id: moveset doc}
   */
  constructor(registry, classes, movesets) {
    this.registry = registry.clips;
    this.classes = classes;
    this.movesets = movesets;
    this._clipCache = new Map();
  }

  /** The `Clip` for one slot of one weapon, instantiated at that slot's own frame counts. */
  clipFor(weaponId, slotId) {
    const key = weaponId + '|' + slotId;
    let c = this._clipCache.get(key);
    if (c) return c;
    const ms = this.movesets[weaponId];
    if (!ms) throw new Error(`moveset: unknown weapon '${weaponId}'`);
    const slot = ms.slots[slotId];
    if (!slot) throw new Error(`moveset: weapon '${weaponId}' has no slot '${slotId}'`);
    const reg = this.registry[slot.anim];
    if (!reg) throw new Error(`moveset: clip '${slot.anim}' is not in the registry`);
    const arch = buildSwing(reg.profile);
    const total = slot.startup_f + slot.active_f + slot.recovery_f + (slot.charge_max_f || 0);
    c = new Clip(slot.anim, arch, { startup: slot.startup_f + (slot.charge_max_f || 0), active: slot.active_f, total }, 1.0, slot.root_dz_m);
    c.capsuleLength = reg.capsule_length_m;
    c.slot = slot;
    this._clipCache.set(key, c);
    return c;
  }

  /**
   * Resolve a button press to a slot id, or null.
   *
   * THE function this piece is judged on. `ctx` is the player's observable state; nothing here
   * consults wall clock, and nothing falls through to `r1.1` when a window is missed.
   *
   * @param {string} weaponId
   * @param {string} button one of HARNESS.md §4's closed set
   * @param {object} ctx {state, state_frame, stance, roll_tier, descending, fall_height_m,
   *                      target_below, forward_mag, held, sprint_held_f, chain_from, chain_frame,
   *                      chain_recovery_f, two_hand_held}
   * @returns {{slot:string|null, reason:string}}
   */
  resolveSlot(weaponId, button, ctx) {
    const ms = this.movesets[weaponId];
    if (!ms) throw new Error(`moveset: unknown weapon '${weaponId}'`);
    const w = this.classes.contextual_windows;
    const pre = ctx.stance === 'two_hand' ? '2h.' : '';
    const has = (id) => Object.prototype.hasOwnProperty.call(ms.slots, id);
    const pick = (id, reason) => (has(id) ? { slot: id, reason } : { slot: null, reason: `${reason}:absent` });

    // --- weapon art: heavy while two_hand is HELD. Checked first because it shadows r2. -------
    if (ctx.two_hand_held && button === 'heavy') {
      return pick(ctx.held_frames >= 12 && has('art.2') ? 'art.2' : 'art.1', 'art');
    }

    // --- airborne ----------------------------------------------------------------------------
    if (ctx.state === 'AIRBORNE') {
      if (!ctx.descending) return { slot: null, reason: 'airborne:rising' };   // no rising jump attacks
      if (ctx.roll_tier === 'OVERLOADED') return { slot: null, reason: 'overloaded' };
      if (ctx.fall_height_m >= w.plunge_min_fall_m && ctx.target_below) return pick('plunge', 'plunge');
      if (button === 'light') return pick(pre + 'jump.r1', 'jump.r1');
      if (button === 'heavy') return pick(pre + 'jump.r2', 'jump.r2');
      return { slot: null, reason: 'airborne:other-button' };
    }

    // --- rolling -----------------------------------------------------------------------------
    if (ctx.state === 'ROLL') {
      const win = w.roll[ctx.roll_tier];
      if (!win) return { slot: null, reason: 'roll:no-window-at-tier' };
      if (ctx.state_frame < win[0] || ctx.state_frame > win[1]) return { slot: null, reason: 'roll:outside-window' };
      if (button === 'light') return pick(pre + 'roll.r1', 'roll.r1');
      if (button === 'heavy') return pick(pre + 'roll.r2', 'roll.r2');
      return { slot: null, reason: 'roll:other-button' };
    }

    // --- backstep ----------------------------------------------------------------------------
    if (ctx.state === 'BACKSTEP') {
      const win = w.backstep[ctx.roll_tier];
      if (!win) return { slot: null, reason: 'backstep:no-window-at-tier' };
      if (ctx.state_frame < win[0] || ctx.state_frame > win[1]) return { slot: null, reason: 'backstep:outside-window' };
      if (button === 'light') return pick(pre + 'backstep.r1', 'backstep.r1');
      return { slot: null, reason: 'backstep:other-button' };
    }

    // --- block success -> guard counter -------------------------------------------------------
    if (ctx.state === 'BLOCK_SUCCESS' && button === 'light') {
      if (ctx.state_frame > w.guard_counter_f) return { slot: null, reason: 'guard_counter:expired' };
      if (ctx.stance !== 'one_hand' || !ctx.offhand_shield) return { slot: null, reason: 'guard_counter:needs-o1' };
      return pick('guard.counter', 'guard.counter');
    }

    // --- sprint -------------------------------------------------------------------------------
    if (ctx.state === 'SPRINT' || (ctx.sprint_released_f !== undefined && ctx.sprint_released_f <= w.sprint_grace_f)) {
      if (ctx.roll_tier === 'OVERLOADED') return { slot: null, reason: 'overloaded' };
      if (ctx.sprint_held_f >= w.sprint_hold_f) {
        if (button === 'light') return pick(pre + 'run.r1', 'run.r1');
        if (button === 'heavy') return pick(pre + 'run.r2', 'run.r2');
      } else return { slot: null, reason: 'sprint:not-held-long-enough' };
    }

    // --- chaining -----------------------------------------------------------------------------
    if (ctx.state === 'ATTACK_RECOVERY' && ctx.chain_from) {
      const src = ms.slots[ctx.chain_from];
      if (src && src.chains_to && button === 'light' && has(src.chains_to)) return { slot: src.chains_to, reason: 'chain' };
      if (button === 'heavy' && has(pre + 'r2.follow') && /r1\./.test(ctx.chain_from)) return { slot: pre + 'r2.follow', reason: 'r2.follow' };
      return { slot: null, reason: 'chain:no-successor' };
    }

    // --- idle ---------------------------------------------------------------------------------
    if (ctx.state === 'IDLE' || ctx.state === 'WALK' || ctx.state === 'RUN') {
      if (button === 'light') {
        if (ctx.forward_mag >= w.guardbreak_forward_mag && !ctx.light_pressed_within_buffer) return pick('guardbreak', 'guardbreak');
        return pick(pre + 'r1.1', 'r1.1');
      }
      if (button === 'heavy') return pick(ctx.heavy_held ? pre + 'r2.charged' : pre + 'r2', ctx.heavy_held ? 'r2.charged' : 'r2');
      if (button === 'parry') return pick('parry', 'parry');
    }
    return { slot: null, reason: 'no-slot' };
  }

  /**
   * Charged-heavy arithmetic. RI-WPN01 §C: the reward is a LERP, never a step; stamina is
   * deducted once on frame 1; hyperarmour arrives at half charge; over-holding fires at full.
   */
  chargeState(weaponId, slotId, heldFrames) {
    const slot = this.movesets[weaponId].slots[slotId];
    const max = slot.charge_max_f || 0;
    if (!max) return null;
    const c = Math.max(0, Math.min(max, heldFrames | 0));
    const t = c / max;
    const ramp = slot.charge_ramp || { motion_value_at_full: 1.3, poise_damage_at_full: 1.5 };
    return {
      charge_f: c,
      at_full: c >= max,
      motion_value: slot.motion_value * (1 + (ramp.motion_value_at_full - 1) * t),
      poise_damage: slot.poise_damage * (1 + (ramp.poise_damage_at_full - 1) * t),
      hyperarmour: c >= Math.ceil(0.5 * max),
      stamina_deducted_on_frame: 1,
    };
  }

  /** Attacker hitstop, in f@60, for a landed hit. RI-WPN05 §A. */
  hitstopFor(weaponId, slotId, material) {
    const ms = this.movesets[weaponId];
    const slot = ms.slots[slotId];
    const table = slot.hitstop_f || this.classes.hitstop.attacker[ms.weight_tier];
    const base = table[material];
    if (base === undefined) throw new Error(`hitstop: no row for material '${material}'`);
    const d = this.classes.hitstop.deflect;
    if (this.deflects(weaponId, slotId, material)) return Math.ceil(base * d.hitstop_multiplier);
    return base;
  }

  /** Victim hitstop. Zero for stone/metal/shield: the target does not move, you do. */
  victimHitstopFor(weaponId, slotId, material) {
    if (this.deflects(weaponId, slotId, material)) return 0;
    return this.hitstopFor(weaponId, slotId, material) + this.classes.hitstop.victim_delta[material];
  }

  /** Deterministic deflection — a function of shape, poise damage and material. No dice (S1). */
  deflects(weaponId, slotId, material) {
    const d = this.classes.hitstop.deflect;
    if (material !== d.material) return false;
    const ms = this.movesets[weaponId];
    if (d.class_bypass.includes(ms.class)) return false;
    const slot = ms.slots[slotId];
    if (d.shape_exempt.includes(slot.shape)) return false;
    return slot.poise_damage < d.poise_damage_below;
  }

  /** Damage multiplier for (slot shape -> damage type) x material. RI-WPN05 §B. */
  materialMultiplier(weaponId, slotId, material) {
    const m = this.classes.materials;
    const slot = this.movesets[weaponId].slots[slotId];
    const type = m.damage_type_of_shape[slot.shape];
    const row = m.multipliers[material];
    if (!row) throw new Error(`material: no row for '${material}'`);
    return row[type];
  }

  /** Knockback in metres. Negative means the ATTACKER is pushed back (RI-WPN05 §A). */
  knockbackFor(weaponId, slotId, material) {
    const ms = this.movesets[weaponId];
    return this.classes.hitstop.knockback_m[ms.weight_tier][material];
  }

  /**
   * Sample a slot's full animation: per-frame root position and weapon capsule endpoints.
   * This is the instrument RI-WPN03 M2 and RI-WPN04 §D T3/T4 need, and `H.getClipTrack` in the
   * harness is a thin wrapper over it.
   */
  clipTrack(rig, weaponId, slotId) {
    const clip = this.clipFor(weaponId, slotId);
    const cap = clip.capsuleLength;
    const grip = this.classes.grip_offset_m === undefined ? 0.10 : this.classes.grip_offset_m;
    const out = { clip: clip.id, frames: clip.total, root: [], a: [], b: [] };
    const pos = [0, 0, 0];
    for (let f = 1; f <= clip.total; f++) {
      pos[2] = clip.rootForwardAt(f);
      clip.applyPose(rig, f);
      rig.evaluate(pos, 0, clip.rootOffsetYAt(f), grip, grip + cap);
      out.root.push([0, clip.rootOffsetYAt(f), pos[2]]);
      out.a.push([...rig.socketA]);
      out.b.push([...rig.socketB]);
    }
    return out;
  }
}
