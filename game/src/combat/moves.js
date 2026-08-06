// The move table: every committed action in the game, assembled from the data files.
//
// NOTHING in this file invents a number. Every frame count, cost, window and multiplier is
// read out of game/data/combat/*.json, which transcribe RI-CMB01 §B, RI-CMB02 §A/§B/§C,
// RI-CMB03 §B/§D, RI-CMB05 §B/§C/§D, RI-CMB08 §C and the S13 parley. The data file is the
// DECLARATION and the trace is the OBSERVATION; a critic diffs them and a mismatch is a hard
// fail (HARNESS.md §7 rule 4). That pair only works if the code never holds a second copy of
// a number, so it doesn't.
'use strict';

import { Clip, LoopClip } from './clips.js';

/** RI-CMB07 §A's closed player-state enum, plus the two declared extensions. */
export const PLAYER_STATE_ENUM = [
  'IDLE', 'WALK', 'RUN', 'SPRINT',
  'ATK_STARTUP', 'ATK_ACTIVE', 'ATK_RECOVER',
  'ROLL_STARTUP', 'ROLL_IFRAME', 'ROLL_RECOVER', 'BACKSTEP',
  'BLOCK_HOLD', 'BLOCK_IMPACT', 'GUARD_BREAK',
  'PARRY_ACTIVE', 'PARRY_RECOVER', 'CRIT_ATTACK',
  'HEAL_STARTUP', 'HEAL_ACTIVE', 'HEAL_RECOVER',
  'STAGGER', 'KNOCKDOWN', 'DEAD',
  // --- declared extensions, see STATE_ENUM_EXTENSIONS ---
  'PARLEY_STARTUP', 'PARLEY_ACTIVE', 'PARLEY_RECOVER',
  'JUMP_RISE', 'JUMP_AIR', 'JUMP_LAND', 'STANCE_SWITCH', 'SWAP',
  // --- W1-14, seam S19: casting is an action in the fight and needs states in the same
  //     vocabulary as every other committed action. Declared, never smuggled.
  'CAST_WINDUP', 'CAST_RELEASE', 'CAST_RECOVER', 'AIRBORNE',
];

export const STATE_ENUM_EXTENSIONS = {
  added: ['PARLEY_STARTUP', 'PARLEY_ACTIVE', 'PARLEY_RECOVER'],
  added_wave1_magic: {
    states: ['CAST_WINDUP', 'CAST_RELEASE', 'CAST_RECOVER', 'AIRBORNE'],
    why:
      'Seam S19: inside the fight, casting is a Souls action with a startup you cannot take ' +
      'back, an active window in which geometry exists in the world, and a recovery tail. ' +
      "RI-MAG01 §B gives it frame data on exactly ES-CAST/1's terms and RI-MAG01 M1 reads " +
      '`player.cast.phase` per frame, which requires the phases to be states rather than a ' +
      'flag. `AIRBORNE` is RI-MAG02 §F3: a levitating caster can neither attack, cast (except ' +
      '`slowfall`), block, roll nor parry, and has no i-frames of any kind — a state, not a ' +
      'set of denials scattered across the input handler.',
  },
  why:
    "RI-CMB07 §A's player state enum is closed and fail-closed, and it predates the wave-0 " +
    'amendment to ARBITRATION §1 / seam S13 (drift ID-01) which makes a non-lethal exit from a ' +
    'fight against anything capable of speech MANDATORY and a humanoid without one a DEFECT. ' +
    'The parley is a committed animated action with startup, active and recovery frames on ' +
    'exactly the terms every other action in the fight has, so it needs states in the same ' +
    'vocabulary. They are DECLARED in the trace META rather than smuggled in, so a conforming ' +
    'reader validates against the declared set and still fails closed on anything unexpected.',
  added_wave1_remediation: {
    states: ['JUMP_RISE', 'JUMP_AIR', 'JUMP_LAND', 'STANCE_SWITCH', 'SWAP'],
    why:
      "The W1-09 verdict §2.3 found `jump`, `two_hand`, `swap_right`, `swap_left` and `menu` " +
      'ACCEPTED AND INERT: pressing jump produced no state change, max_y 0.0000 over 90 frames ' +
      'and no stamina deduction, against a declared cost of 18. That made RI-CMB02 §C\'s ' +
      "jump-attack row, RI-CMB01 §B's OVERLOADED jump-attack prohibition and RI-WPN06's whole " +
      'stance contract structurally unmeasurable — "the methods are absent rather than ' +
      'present-and-lying" does not cover a button that IS present and does nothing. They are ' +
      'now real committed actions with real states, real costs and real frame data ' +
      '(frames.json §actions), declared here on exactly the terms the PARLEY_* extension was.',
    menu:
      'NOT a state. `menu` opens a UI surface and DOES NOT PAUSE the fixed step — see ' +
      'frames.json §actions.menu. AR-1 probe A3 ("pause mid-fight") was scored not_run for want ' +
      'of a menu surface; it is now runnable and the answer is the Souls-side one.',
  },
  not_added: {
    EXHAUSTED:
      'RI-CMB09 §6 asks for EXHAUSTED as a state. It is carried instead as the boolean field ' +
      'p.exhausted plus exhausted_enter / exhausted_exit events, because an exhausted player ' +
      'still WALKS and "walk only" is one of the defining properties RI-CMB09 §4 gives the ' +
      'state — collapsing it into p.state would delete the observation the item wants. ' +
      "RI-CMB09 M5's checks are all measurable off the events. Recorded in stamina.json.",
  },
};

export const ENEMY_STATE_ENUM = [
  'IDLE', 'REPOSITION', 'APPROACH', 'ATK_WINDUP', 'ATK_ACTIVE', 'ATK_INTERVAL',
  'ATK_RECOVER', 'STAGGER', 'GUARD_BREAK', 'PARRIED', 'DEAD',
  'BLOCK_HOLD', 'YIELDED',
];

/**
 * Build every move for one weapon + shield loadout.
 *
 * @param {object} d all of game/data/combat/*.json, keyed by basename
 * @param {object} moveset one game/data/combat/movesets/*.json
 * @param {string} shieldId a key of stamina.json §block.shields, or null
 */
export function buildMoveTable(d, moveset, shieldId, opts) {
  const arch = d.clips.archetypes;
  const wpn = moveset.weapon;
  const out = {};
  const socketA = wpn.socket_a_dist_m;
  const socketB = wpn.socket_b_dist_m;

  // ---- attacks (RI-CMB02 §A/§B) ----------------------------------------------------------
  // `twoHanded` overlays the class's declared two-handed row (spine/*.json §moves.two_handed):
  // a DIFFERENT pose archetype, amplitude and root displacement — RI-WPN06 §B's divergence
  // clause — on top of RI-CMB02 §C's ×1.00 frame counts, ×1.15 stamina, ×1.15 motion value and
  // ×1.30 poise damage, plus §C's R1 hyperarmour on axe / greatsword / ultra greatsword.
  const twoHanded = !!(opts && opts.twoHanded) && !!moveset.moves.two_handed;
  for (const id of ['light', 'heavy']) {
    const base = moveset.moves[id];
    const m = twoHanded ? Object.assign({}, base, moveset.moves.two_handed[id]) : base;
    const clip = new Clip(m.anim, arch[m.archetype], { startup: m.startup, active: m.active, total: m.total }, m.amplitude, m.root_dz_m);
    out[id] = {
      id,
      kind: 'attack',
      anim: m.anim,
      archetype: m.archetype,
      clip,
      startup: m.startup,
      Ps: m.Ps,
      active: m.active,
      recovery: m.recovery,
      total: m.total,
      stamina: m.stamina,
      poise_damage: m.poise_damage,
      motion_value: m.motion_value,
      hyperarmour_window: m.hyperarmour_window,
      hitbox: true,
      hitbox_radius_m: wpn.radius_m,
      socket_a_dist_m: socketA,
      socket_b_dist_m: socketB,
      socket_a: wpn.socket_a,
      socket_b: wpn.socket_b,
      hitstop_frames: m.hitstop_frames,
      root_dz_m: m.root_dz_m,
      reach_m_declared: m.reach_m_declared,
      two_handed: twoHanded,
      iframes: null,
      // RI-CMB02 §D — the commitment rule, computed from the item's own formula.
      hard_until: m.startup + m.active + Math.ceil(0.45 * m.recovery),
      dodge_cancel_from: m.startup + m.active + Math.ceil(0.45 * m.recovery) + 1,
      states: { startup: 'ATK_STARTUP', active: 'ATK_ACTIVE', recovery: 'ATK_RECOVER' },
      source: m.source,
    };
  }

  // ---- rolls and backsteps, one per equip-load tier (RI-CMB01 §B) ------------------------
  const sub = d.roll.recovery_substructure;
  for (const tier of ['LIGHT', 'MEDIUM', 'HEAVY', 'OVERLOADED']) {
    for (const kind of ['roll', 'backstep']) {
      const r = d.roll[kind][tier];
      const startup = r.startup ? r.startup[1] : 0;
      const ifw = r.iframes;
      const iframeLen = ifw ? ifw[1] - ifw[0] + 1 : 0;
      const recStart = ifw ? ifw[1] + 1 : (r.startup ? r.startup[1] + 1 : 1);
      const recovery = r.total - recStart + 1;
      const archName = kind === 'roll' ? (tier === 'OVERLOADED' ? 'backstep' : 'roll_ground') : 'backstep';
      const clip = new Clip(`${kind}_${tier.toLowerCase()}`, arch[archName],
        { startup, active: iframeLen, total: r.total },
        tier === 'HEAVY' ? 0.85 : tier === 'OVERLOADED' ? 0.6 : 1.0,
        kind === 'backstep' ? -r.distance_m : r.distance_m);
      const hard = Math.max(0, Math.round(sub.hard_fraction * recovery));
      out[`${kind}_${tier}`] = {
        id: kind,
        kind,
        tier,
        anim: clip.id,
        clip,
        startup,
        active: iframeLen,
        recovery,
        total: r.total,
        stamina: r.stamina,
        distance_m: r.distance_m,
        iframes: ifw,
        iframe_count: r.iframe_count,
        hitbox: false,
        hitstop_frames: 0,
        anim_speed: r.anim_speed || 1.0,
        // RI-CMB09 §2 sub-structure, derived from the item's own fractions.
        recovery_hard_f: hard,
        recovery_turn_f: recovery - hard,
        hard_until: recStart + hard - 1,
        turn_rate_dps: sub.turn_rate_dps,
        buffer_f: sub.buffer_frames,
        states: kind === 'roll'
          ? { startup: 'ROLL_STARTUP', active: 'ROLL_IFRAME', recovery: 'ROLL_RECOVER' }
          : { startup: 'BACKSTEP', active: 'BACKSTEP', recovery: 'BACKSTEP' },
        source: 'RI-CMB01 §B / RI-CMB09 §1–§2',
      };
    }
  }

  // ---- parry (RI-CMB05 §D) ---------------------------------------------------------------
  const parryClass = shieldId ? d.stamina.block.shields[shieldId].class : (wpn.parry_class || null);
  const pd = parryClass ? d.poise.criticals.parry.by_class[parryClass] : null;
  if (pd) {
    const startup = pd.active[0] - 1;
    const activeLen = pd.active[1] - pd.active[0] + 1;
    out.parry = {
      id: 'parry',
      kind: 'parry',
      anim: `parry_${parryClass}`,
      clip: new Clip(`parry_${parryClass}`, arch.parry_sweep, { startup, active: activeLen, total: pd.animation_f }, 1.0, 0),
      startup,
      active: activeLen,
      recovery: pd.animation_f - pd.active[1],
      total: pd.animation_f,
      parry_window: pd.active,
      whiff_recovery_f: pd.whiff_recovery_f,
      stamina: pd.stamina,
      hitbox: false,
      iframes: null,
      hitstop_frames: 0,
      shield_class: parryClass,
      states: { startup: 'PARRY_ACTIVE', active: 'PARRY_ACTIVE', recovery: 'PARRY_RECOVER' },
      source: 'RI-CMB05 §D',
    };
  }

  // ---- criticals (RI-CMB05 §D) ------------------------------------------------------------
  const bs = d.poise.criticals.backstab;
  out.backstab = critMove('backstab', bs.animation_f, bs.damage_frame, bs.attacker_invulnerable, bs.stamina,
    bs.crit_multiplier[moveset.class_key] || 1.0, arch.crit_thrust, 'RI-CMB05 §D backstab');
  const rp = d.poise.criticals.riposte;
  out.riposte = critMove('riposte', rp.animation_f, rp.damage_frame, rp.attacker_invulnerable, rp.stamina,
    (bs.crit_multiplier[moveset.class_key] || 1.0) * 1.50, arch.crit_thrust, 'RI-CMB05 §D riposte (backstab damage x 1.50)');

  // ---- heal (RI-CMB08 §C) ------------------------------------------------------------------
  const fl = d.flask.animation;
  out.heal = {
    id: 'heal',
    kind: 'heal',
    anim: 'heal_drink',
    clip: new Clip('heal_drink', arch.heal_drink,
      { startup: fl.phases.HEAL_STARTUP[1], active: fl.phases.HEAL_ACTIVE[1] - fl.phases.HEAL_ACTIVE[0] + 1, total: fl.total_f }, 1.0, 0),
    startup: fl.phases.HEAL_STARTUP[1],
    active: fl.phases.HEAL_ACTIVE[1] - fl.phases.HEAL_ACTIVE[0] + 1,
    recovery: fl.total_f - fl.phases.HEAL_ACTIVE[1],
    total: fl.total_f,
    stamina: fl.stamina_cost,
    hitbox: false,
    iframes: null,
    hitstop_frames: 0,
    ramp_frames: d.flask.heal.ramp_frames,
    heal_active: fl.phases.HEAL_ACTIVE,
    heal_secure_frames: fl.heal_secure_frames,
    dodge_cancel_from: 117,
    walk_speed_mult: fl.movement_frames_1_to_104.walk_speed_mult,
    walk_until: fl.phases.HEAL_ACTIVE[1],
    turn_rate_dps: fl.turn_rate_frames_1_to_104_dps,
    states: { startup: 'HEAL_STARTUP', active: 'HEAL_ACTIVE', recovery: 'HEAL_RECOVER' },
    source: 'RI-CMB08 §C',
  };

  // ---- parley (ARBITRATION §1 / seam S13) --------------------------------------------------
  const pl = d.parley.the_interaction;
  out.parley = {
    id: 'parley',
    kind: 'parley',
    anim: 'parley_open',
    clip: new Clip('parley_open', arch.parley_open,
      { startup: pl.phases.PARLEY_STARTUP[1], active: pl.phases.PARLEY_ACTIVE[1] - pl.phases.PARLEY_ACTIVE[0] + 1, total: pl.total_f }, 1.0, 0),
    startup: pl.phases.PARLEY_STARTUP[1],
    active: pl.phases.PARLEY_ACTIVE[1] - pl.phases.PARLEY_ACTIVE[0] + 1,
    recovery: pl.total_f - pl.phases.PARLEY_ACTIVE[1],
    total: pl.total_f,
    stamina: pl.stamina,
    hitbox: false,
    iframes: null,
    hitstop_frames: 0,
    resolution_frame: pl.resolution_frame,
    range_m: pl.range_m,
    arc_deg: pl.arc_deg,
    target_must_face_back_deg: pl.target_must_face_back_deg,
    refuse_cooldown_f: pl.refuse_cooldown_f,
    turn_rate_dps: pl.turn_rate_dps,
    states: { startup: 'PARLEY_STARTUP', active: 'PARLEY_ACTIVE', recovery: 'PARLEY_RECOVER' },
    source: 'ARBITRATION §1 as amended (drift ID-01) / seam S13 as amended',
  };

  // ---- jump, stance switch and quick swap (frames.json §actions) ------------------------------
  const acts = d.frames.actions;
  if (acts && acts.jump) {
    const j = acts.jump;
    out.jump = {
      id: 'jump',
      kind: 'jump',
      anim: 'jump',
      clip: new Clip('jump', arch.jump_arc, { startup: j.startup, active: j.airborne, total: j.total }, 1.0, 0.9),
      startup: j.startup,
      active: j.airborne,
      recovery: j.landing,
      total: j.total,
      stamina: d.stamina.costs.jump,
      apex_m: j.apex_m,
      // RI-WPN04 §B: "AIRBORNE and vel_y < 0 … No rising jump attacks."
      attack_from: j.startup + Math.ceil(j.airborne / 2) + 1,
      airborne: [j.startup + 1, j.startup + j.airborne],
      hitbox: false,
      iframes: null,          // a jump is not a dodge. Ever.
      hitstop_frames: 0,
      states: { startup: 'JUMP_RISE', active: 'JUMP_AIR', recovery: 'JUMP_LAND' },
      source: 'frames.json §actions.jump (constructed) + RI-CMB03 §B for the 18 stamina',
    };
  }
  if (acts && acts.stance_switch) {
    const t = acts.stance_switch;
    out.stance_switch = {
      id: 'stance_switch',
      kind: 'stance',
      anim: twoHanded ? 'stance_to_one_hand' : 'stance_to_two_hand',
      clip: new Clip('stance_switch', arch.stance_switch, { startup: 0, active: 0, total: t.total }, 1.0, 0),
      startup: 0, active: 0, recovery: t.total, total: t.total,
      stamina: t.stamina,
      legal_from: t.legal_from,
      hitbox: false, iframes: null, hitstop_frames: 0,
      states: { startup: 'STANCE_SWITCH', active: 'STANCE_SWITCH', recovery: 'STANCE_SWITCH' },
      source: 'RI-WPN06 §A (36 f@60, root-locked, uncancellable, legal from IDLE/WALK/RUN only)',
    };
  }
  if (acts && acts.quick_swap) {
    const q = acts.quick_swap;
    out.swap = {
      id: 'swap',
      kind: 'swap',
      anim: 'quick_swap',
      clip: new Clip('quick_swap', arch.quick_swap, { startup: 0, active: 0, total: q.total }, 1.0, 0),
      startup: 0, active: 0, recovery: q.total, total: q.total,
      stamina: q.stamina,
      legal_from: q.legal_from,
      hitbox: false, iframes: null, hitstop_frames: 0,
      states: { startup: 'SWAP', active: 'SWAP', recovery: 'SWAP' },
      source: 'frames.json §actions.quick_swap (constructed, shaped by RI-WPN06 §A\'s no-instant-toggle rule)',
    };
  }

  // ---- reaction states (RI-CMB05 §B, RI-CMB03 §D) --------------------------------------------
  out._stagger = {};
  for (const t of d.poise.stagger.tiers) {
    out._stagger[t.tier] = {
      id: `stagger_${t.tier}`,
      kind: 'stagger',
      anim: `stagger_${t.tier}`,
      clip: new Clip(`stagger_${t.tier}`, arch.stagger_recoil, { startup: Math.ceil(t.frames * 0.3), active: Math.ceil(t.frames * 0.3), total: t.frames }, 1.0, -t.pushback_m),
      total: t.frames,
      knockdown: !!t.knockdown,
      getup_frames: t.getup_frames || 0,
      getup_iframes: t.getup_iframes || 0,
      pushback_m: t.pushback_m,
      poise_damage_range: t.poise_damage,
      hitbox: false,
      iframes: null,
      states: { startup: 'STAGGER', active: 'STAGGER', recovery: 'STAGGER' },
      source: 'RI-CMB05 §B',
    };
  }
  const gb = d.stamina.guard_break;
  out._guardBreak = {
    id: 'guard_break',
    kind: 'guard_break',
    anim: 'guard_break',
    clip: new Clip('guard_break', arch.guard_break_open, { startup: 10, active: 10, total: gb.duration_f }, 1.0, -0.25),
    total: gb.duration_f,
    riposte_window: gb.riposte_window,
    hitbox: false,
    iframes: null,
    states: { startup: 'GUARD_BREAK', active: 'GUARD_BREAK', recovery: 'GUARD_BREAK' },
    source: 'RI-CMB03 §D',
  };

  // ---- non-committed loops ------------------------------------------------------------------
  // `_idle` plays `idle_loop` — a breathing/weight-shift cycle with NO absolute arm pose —
  // because the stance layer below ADDS `idle_ready` on top of whatever loop is playing. It
  // used to play `idle_ready` itself, so a standing character held DOUBLE the authored idle
  // pose while every attack clip ended on a single one: that difference is the 1.42–2.54 m
  // single-frame weapon snap the W1-09 verdict §2.5 measured at the attack/idle boundary. See
  // clips.json §archetypes.idle_loop.
  out._idle = new LoopClip('idle', arch.idle_loop, 96);
  out._walk = new LoopClip('walk', arch.locomotion_cycle, 44);
  out._run = new LoopClip('run', arch.locomotion_cycle, 30);
  out._sprint = new LoopClip('sprint', arch.locomotion_cycle, 22);
  out._blockPose = arch.block_hold;
  out._idlePose = arch.idle_ready;
  out._dead = new Clip('dead', arch.dead_collapse, { startup: 12, active: 12, total: 48 }, 1.0, 0.4);

  out._weapon = wpn;
  out._movesetId = moveset.id + (twoHanded ? ':two_handed' : '');
  out._classKey = moveset.class_key;
  out._twoHanded = twoHanded;
  out._hasTwoHanded = !!moveset.moves.two_handed;
  return out;

  function critMove(id, total, dmgFrame, invuln, stam, mult, archetype, source) {
    return {
      id,
      kind: 'crit',
      anim: `crit_${id}`,
      clip: new Clip(`crit_${id}`, archetype, { startup: dmgFrame - 1, active: 8, total }, 1.0, 0.55),
      startup: dmgFrame - 1,
      active: 8,
      recovery: total - dmgFrame - 7,
      total,
      damage_frame: dmgFrame,
      iframes: invuln,
      stamina: stam,
      crit_multiplier: mult,
      hitbox: false,
      hitstop_frames: 10,
      states: { startup: 'CRIT_ATTACK', active: 'CRIT_ATTACK', recovery: 'CRIT_ATTACK' },
      source,
    };
  }
}

/** RI-CMB01 §B tier lookup — cliffs, never a ramp (M5). */
export function equipTier(loadPct, boundaries) {
  if (loadPct > boundaries.HEAVY) return 'OVERLOADED';
  if (loadPct > boundaries.MEDIUM) return 'HEAVY';
  if (loadPct > boundaries.LIGHT) return 'MEDIUM';
  return 'LIGHT';
}
