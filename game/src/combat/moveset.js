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

/**
 * The seven ids W1-09's class spine shipped, mapped onto the roster baseline of the same class.
 *
 * W1-10 round 1 shipped 87 movesets that the running game could not reach: `createPlayer()` read
 * `game/data/combat/spine/*.json` and answered every roster id with
 * "no moveset 'ssw_garrison_sword'. Known: axe, dagger, greatsword, ...". Rather than keep two
 * move sources in the game and hope they agree, the spine ids are now ALIASES: `straight-sword`
 * IS `ssw_garrison_sword`. Every scenario file, every W1-09 probe and every saved loadout keeps
 * working, and there is exactly one attack code path in the build, so "the data says one thing
 * and the runtime does another" is not a state this game can be in.
 */
export const SPINE_ALIASES = {
  dagger: 'dgr_shell_knife',
  'straight-sword': 'ssw_garrison_sword',
  spear: 'spr_fishers_gig',
  axe: 'axe_shell_splitter',
  halberd: 'hlb_garrison_bill',
  greatsword: 'gsw_memorial_blade',
  'ultra-greatsword': 'ugs_golem_sword',
};

/**
 * RI-CMB05 owns the hyperarmour pools and the crit multipliers, and publishes them for the seven
 * spine classes only. The eight classes RI-WPN02 §A adds have no RI-CMB05 row, so each is mapped
 * to its nearest anchor rather than given an invented number. Declared here, not smuggled.
 */
export const CLASS_KEY = {
  DGR: 'dagger', FST: 'dagger', CSW: 'straight_sword', TSW: 'straight_sword',
  SSW: 'straight_sword', SPR: 'spear', AXE: 'axe', MCE: 'axe', WHP: 'spear',
  HLB: 'halberd', GSW: 'greatsword', CGS: 'greatsword', GHM: 'greatsword',
  UGS: 'ultra_greatsword', BOW: 'dagger',
};

/** Distance from the grip hand to the guard, metres. RI-CMB04 §B's rig convention. */
export const GRIP_OFFSET_M = 0.10;

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

  /** Resolve a spine alias or a roster id to a roster weapon id. Throws if neither. */
  resolveWeaponId(id) {
    const w = SPINE_ALIASES[id] || id;
    if (!this.movesets[w]) {
      throw new Error(`moveset: unknown weapon '${id}'. ${Object.keys(this.movesets).length} roster ids ` +
        `plus the seven spine aliases (${Object.keys(SPINE_ALIASES).join(', ')}).`);
    }
    return w;
  }

  /**
   * The two socket distances, in metres from the grip hand, for one slot.
   *
   * ONE function, used by the live hitbox in `CombatBody.evaluateRig` AND by `clipTrack`, which
   * is what the harness reports as the declared clip. RI-WPN04 §D T4 compares them; they cannot
   * disagree because they are the same arithmetic. `socket_b` is the clip's own blade length
   * (`reach − lunge − arm`, from the clip registry) and `socket_a` is `hitbox_span_m` back from
   * the tip, floored at the grip — a sword is edged over almost its whole length and an axe only
   * at the head, which is the difference RI-WPN05 §E's tip-speed band exists to see.
   */
  socketsFor(weaponId, slotId) {
    const clip = this.clipFor(weaponId, slotId);
    const cls = this.classes.classes[this.movesets[weaponId].class];
    const b = clip.capsuleLength;
    const span = cls && cls.hitbox_span_m !== undefined ? cls.hitbox_span_m : b;
    return { a: Math.max(GRIP_OFFSET_M, Math.round((b - span) * 1000) / 1000), b: Math.round(b * 1000) / 1000 };
  }

  /**
   * The weapon block a move table needs: geometry derived from this weapon's own clips, and the
   * four per-class numbers (`attack_rating`, `equip_weight`, `hitbox_span_m`, `parry_class`) that
   * `game/data/weapons/classes.json` now carries. The seven anchor classes reproduce W1-09's
   * spine values verbatim; the eight extension classes are derived and marked PROVISIONAL there.
   */
  weaponFor(weaponId) {
    const key = 'W|' + weaponId;
    let w = this._clipCache.get(key);
    if (w) return w;
    const ms = this.movesets[weaponId];
    if (!ms) throw new Error(`moveset: unknown weapon '${weaponId}'`);
    const cls = this.classes.classes[ms.class];
    const lead = ms.slots['r1.1'] ? 'r1.1' : Object.keys(ms.slots)[0];
    const s = this.socketsFor(weaponId, lead);
    w = {
      weapon_id: weaponId,
      name: ms.name,
      class: ms.class,
      class_key: CLASS_KEY[ms.class] || 'straight_sword',
      weight_tier: ms.weight_tier,
      length_m: s.b,
      capsule_length_m: Math.round((s.b - s.a) * 1000) / 1000,
      radius_m: ms.slots[lead].hitbox.radius_m,
      socket_a: ms.slots[lead].hitbox.bone_a,
      socket_b: ms.slots[lead].hitbox.bone_b,
      socket_a_dist_m: s.a,
      socket_b_dist_m: s.b,
      reach_m: ms.reach_m,
      attack_rating: cls.attack_rating,
      equip_weight: cls.equip_weight,
      parry_class: cls.parry_class || null,
      stance_default: 'one_handed',
      source: 'game/data/combat/movesets/' + weaponId + '.json + game/data/weapons/classes.json',
    };
    this._clipCache.set(key, w);
    return w;
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
    // `extra_slots` are verbs the LOADOUT adds rather than the weapon: RI-WPN06 §C's
    // `shield.bash` / `shield.charge` belong to the offhand, not to the moveset document.
    const extra = ctx.extra_slots && ctx.extra_slots.length ? new Set(ctx.extra_slots) : null;
    const has = (id) => Object.prototype.hasOwnProperty.call(ms.slots, id) || !!(extra && extra.has(id));
    const pick = (id, reason) => (has(id) ? { slot: id, reason } : { slot: null, reason: `${reason}:absent` });

    // --- weapon art: heavy while two_hand is HELD. Checked first because it shadows r2. -------
    // input-map.json: `art.1` is "two_hand held + heavy TAP" and `art.2` is "two_hand held +
    // heavy HELD >= 12 f@60". A press cannot yet know whether it is a tap or a hold, so this
    // always resolves to `art.1` and the runtime promotes it to `art.2` if the button is still
    // down twelve frames later — the same discriminator, and the same place, as `r2.charged`.
    if (ctx.two_hand_held && button === 'heavy') return pick(pre + 'art.1', 'art');

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
    // RI-WPN01 §A slot 16 / RI-WPN04 §B: `light` within 40 f@60 of a BLOCK_SUCCESS. The block
    // must have been landed ONE-HANDED behind a shield (RI-WPN06 §C: O1 is the only configuration
    // with a guard counter), but `2h.guard.counter` is reachable in the one transitional case
    // offhand.json §o3 names — two-handing INSIDE the 40-frame window, which the 36 f@60
    // uncancellable stance switch makes real, tight and deliberately awkward.
    if (ctx.state === 'BLOCK_SUCCESS' && button === 'light') {
      if (ctx.state_frame > w.guard_counter_f) return { slot: null, reason: 'guard_counter:expired' };
      if (!ctx.blocked_with_shield) return { slot: null, reason: 'guard_counter:needs-o1' };
      return pick(pre + 'guard.counter', 'guard.counter');
    }

    // --- guard raised (no successful block yet) -> the guard-break verb -------------------------
    // RI-WPN06 §C gives O1 a `shield.bash` on `light` + forward WITH THE SHIELD RAISED, and
    // RI-WPN01 §A slot 17 gives every weapon a `guardbreak` on `light` + forward from IDLE. The
    // `forward` modifier exists so that a kick is never mistaken for a swing you meant — with the
    // guard already up that ambiguity does not exist, because the shield is what is in front of
    // you and the weapon is not in a swinging posture. So `light` behind a raised guard is the
    // shove, not the standing R1: pressing attack from behind a shield must not silently drop the
    // shield and play `r1.1`, which is exactly the fallback RI-WPN04 exists to detect.
    // `guardbreak` is the one slot RI-WPN04 §D T7 exempts from the no-free-contextual rule.
    if (ctx.state === 'BLOCK_HOLD') {
      if (button === 'light') {
        if (ctx.offhand_shield && has('shield.bash')) return pick('shield.bash', 'shield.bash');
        return pick('guardbreak', 'guardbreak');
      }
      if (button === 'heavy') return { slot: null, reason: 'block:no-heavy-from-guard' };
      if (button === 'parry') return pick('parry', 'parry');
      return { slot: null, reason: 'block:other-button' };
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
    const sock = this.socketsFor(weaponId, slotId);
    const out = { clip: clip.id, frames: clip.total, root: [], a: [], b: [] };
    const pos = [0, 0, 0];
    for (let f = 1; f <= clip.total; f++) {
      pos[2] = clip.rootForwardAt(f);
      clip.applyPose(rig, f);
      rig.evaluate(pos, 0, clip.rootOffsetYAt(f), sock.a, sock.b);
      out.root.push([0, clip.rootOffsetYAt(f), pos[2]]);
      out.a.push([...rig.socketA]);
      out.b.push([...rig.socketB]);
    }
    return out;
  }
}
