// `es-combat-trace/1` — RI-CMB07 §A, emitted from the live simulation.
//
// RI-CMB07's own §0 is the reason this file matters more than it looks: seam S22 invalidated
// the exemplar trace and every statistic derived from it, and the item's acceptance condition
// for closing that gap is "a regenerated exemplar whose META carries no INVALIDATED block,
// whose player constants match RI-CMB01 §B and RI-CMB02 §A/§B as rebased, and whose 29
// statistics are recomputed". Regenerating it means RE-RUNNING the authored input script
// against the rebased constants — not scaling the old output, which the item shows would
// produce an artifact that is wrong in exactly the place the exemplar exists to be right.
// This emitter is what a re-run produces.
'use strict';

import { PLAYER_STATE_ENUM, ENEMY_STATE_ENUM, STATE_ENUM_EXTENSIONS } from './moves.js';

/** The RI-CMB07 §A button bitmask, verbatim. */
export const TRACE_BITS = {
  ATTACK_LIGHT: 1, ATTACK_HEAVY: 2, GUARD: 4, SKILL_PARRY: 8, DODGE: 16,
  SPRINT: 32, HEAL: 64, LOCK_TOGGLE: 128, TWO_HAND: 256,
};

export const EVENT_KINDS = [
  'LOCK_ON', 'LOCK_BREAK', 'LOCK_SWITCH', 'ACTION_START', 'GUARD_UP', 'HIT', 'CRIT_HIT',
  'CRIT_RELEASE', 'WHIFF', 'IFRAME_NEGATE', 'AVOID', 'BLOCK', 'GUARD_BREAK', 'STAGGER',
  'PARRY', 'RIPOSTE', 'ESTUS_START', 'ESTUS_DONE', 'DEATH',
  // declared extensions
  'INPUT_DROPPED', 'INPUT_BUFFERED', 'EXHAUSTED_ENTER', 'EXHAUSTED_EXIT', 'WINDED',
  'PARLEY_ACCEPT', 'PARLEY_REFUSE', 'PARLEY_EXEMPT',
];

export function combatMeta(system, scenarioId, seed) {
  const d = system.d;
  const p = system.player;
  const w = p.moves._weapon;
  return {
    t: 'META',
    schema: 'es-combat-trace/1',
    fps: 60,
    unit: 'f@60',
    unit_note: 'Every frame figure in this trace is at the 60 Hz simulation step. A Souls community tick is t@30 and is a different unit (ARBITRATION S22).',
    encoding: 'per-frame',
    scenario: scenarioId,
    seed,
    generated_by: 'game/src/combat/trace.js from a live headless run',
    s22_status: 'REBASED. The player constants below are RI-CMB01 §B and RI-CMB02 §A/§B as rebased by seam S22, not the pre-rebase figures. This trace is not derived from the invalidated RI-CMB07 exemplar and does not scale it.',
    fields: {
      i: '[stick_x, stick_y, button_bitmask]',
      p: '[state, anim_id, anim_frame, stamina, hp, invuln, hitbox_active]',
      e: '[state, anim_id, anim_frame, hp, hitbox_active] per live enemy, in stable id order',
      v: 'events resolved on this frame; omitted entirely when empty',
      x: 'EXTENSION block: fields this corpus asked for after RI-CMB07 §A was written. See x_fields.',
    },
    x_fields: {
      'p_poise': 'player poise health (RI-CMB05 §A) — the pool, not the stat',
      'p_exhausted': 'RI-CMB09 §4. Carried as a FLAG, not a state; see state_enum_extensions.not_added',
      'p_tier': 'RI-CMB01 §B equip-load tier, evaluated on the frame of the press',
      'p_yaw': 'degrees',
      'p_pos': 'metres [x,y,z]',
      'lock': 'locked target id or null',
      'both_framed': 'RI-CAM03 containment law, MEASURED by projecting both chest nodes',
      'sockets': 'the weapon capsule this frame: [ax,ay,az, bx,by,bz] world space, for RI-CMB04 M2 analytic recomputation',
      'e_poise': 'per enemy',
    },
    state_enum: PLAYER_STATE_ENUM,
    enemy_state_enum: ENEMY_STATE_ENUM,
    state_enum_extensions: STATE_ENUM_EXTENSIONS,
    event_kinds: EVENT_KINDS,
    button_bits: TRACE_BITS,
    player: {
      hp_max: p.hpMax,
      stamina_max: p.staminaMax,
      armour_poise: p.armourPoise,
      poise_health_max: p.poiseHealthMax,
      equip_load_pct: p.equipLoadPct,
      tier: system.tierOf(p),
      weapon: p.moves._movesetId,
      weapon_class: p.moves._classKey,
      attack_rating: w.attack_rating,
      shield: p.shieldId,
      shield_stats: p.shield,
      estus: system.playerCtl.estus,
      flask_level: system.playerCtl.flaskLevel,
    },
    constants: {
      roll: d.roll.roll[system.tierOf(p)],
      backstep: d.roll.backstep[system.tierOf(p)],
      light: pick(p.moves.light),
      heavy: pick(p.moves.heavy),
      parry: p.moves.parry ? { total: p.moves.parry.total, window: p.moves.parry.parry_window, stamina: p.moves.parry.stamina } : null,
      backstab: { total: p.moves.backstab.total, invuln: p.moves.backstab.iframes, damage_frame: p.moves.backstab.damage_frame },
      riposte: { total: p.moves.riposte.total, invuln: p.moves.riposte.iframes, damage_frame: p.moves.riposte.damage_frame },
      heal: { total: p.moves.heal.total, phases: d.flask.animation.phases, secure_frames: p.moves.heal.heal_secure_frames },
      parley: { total: p.moves.parley.total, resolution_frame: p.moves.parley.resolution_frame },
      stamina: {
        regen_per_frame: d.stamina.regen.per_frame,
        regen_delay_f: d.stamina.regen.delay_frames_after_any_spend,
        guard_mult: d.stamina.regen.multipliers.guard_raised,
        floor: d.stamina.regen.floor,
        floor_is_constructed: true,
      },
      poise: { health_max: p.poiseHealthMax, resist: Math.min(0.6, p.armourPoise / 120), stagger_tiers: d.poise.stagger.tiers },
      sweep: { substeps: d.hitgeometry.sweep.substeps, effective_hz: d.hitgeometry.sweep.effective_sampling_hz },
      buffer_f: d.frames.buffer_frames,
    },
    enemies: [...system.enemies.keys()].map((id) => {
      const b = system.bodyOf(id);
      const ec = system.enemies.get(id);
      return {
        id, statblock: b.statId, archetype: b.archetype, hp_max: b.hpMax,
        poise_health_max: b.poiseHealthMax, stamina_max: b.staminaMax,
        parley: b.parley, ai: ec.stat.ai,
        attacks: Object.keys(b.moves).filter((k) => !k.startsWith('_')).map((k) => ({
          id: k, startup: b.moves[k].startup, active: b.moves[k].active,
          recovery: b.moves[k].recovery, total: b.moves[k].total,
          Ps: b.moves[k].Ps, poise_damage: b.moves[k].poise_damage,
          motion_value: b.moves[k].motion_value, punish_window: b.moves[k].punish_window,
        })),
      };
    }),
  };
}

function pick(m) {
  return {
    startup: m.startup, Ps: m.Ps, active: m.active, recovery: m.recovery, total: m.total,
    stamina: m.stamina, poise_damage: m.poise_damage, motion_value: m.motion_value,
    hard_until: m.hard_until, dodge_cancel_from: m.dodge_cancel_from,
    hyperarmour_window: m.hyperarmour_window, root_dz_m: m.root_dz_m,
    hitbox_radius_m: m.hitbox_radius_m, socket_a: m.socket_a, socket_b: m.socket_b,
  };
}

/** One `F` record. RI-CMB07 §A's shape, plus the declared `x` extension block. */
export function combatFrame(system, frame, input, events, camera) {
  const p = system.player;
  const rec = {
    t: 'F',
    f: frame,
    i: [r3(input.moveX), r3(input.moveY), traceMask(input)],
    p: [p.state, p.anim, p.animFrame, r1(p.stamina), Math.round(Math.max(0, p.hp)), p.iframe ? 1 : 0, p.hitboxActive ? 1 : 0],
    e: [],
    x: {
      p_poise: r1(Math.max(0, p.poiseHealth)),
      p_exhausted: p.exhausted ? 1 : 0,
      p_tier: p.tier,
      p_yaw: r2(p.yaw),
      p_pos: [r4(p.pos[0]), r4(p.pos[1]), r4(p.pos[2])],
      p_regen_blocked: frame < p.regenBlockUntil ? 1 : 0,
      p_guard: p.guardRaised ? 1 : 0,
      lock: system.lock.target,
      both_framed: system.lock.bothFramed ? 1 : 0,
      sockets: [r4(p.socketA[0]), r4(p.socketA[1]), r4(p.socketA[2]), r4(p.socketB[0]), r4(p.socketB[1]), r4(p.socketB[2])],
      estus: system.playerCtl.estus,
    },
  };
  for (const b of system.bodies) {
    if (b === p) continue;
    rec.e.push([b.state, b.anim, b.animFrame, Math.round(Math.max(0, b.hp)), b.hitboxActive ? 1 : 0,
      r1(Math.max(0, b.poiseHealth)), r1(b.stamina), r2(b.yaw), r3(system.distTo(b))]);
  }
  if (events && events.length) rec.v = events;
  return rec;
}

/** Map our 15-button action set onto RI-CMB07 §A's 9-bit mask. `crouch` (bit 14) has no combat-trace bit and needs none. */
function traceMask(input) {
  let m = 0;
  const h = input.held | input.pressed;
  if (h & (1 << 0)) m |= TRACE_BITS.ATTACK_LIGHT;
  if (h & (1 << 1)) m |= TRACE_BITS.ATTACK_HEAVY;
  if (h & (1 << 3)) m |= TRACE_BITS.GUARD;
  if (h & (1 << 4)) m |= TRACE_BITS.SKILL_PARRY;
  if (h & (1 << 2)) m |= TRACE_BITS.DODGE;
  if (h & (1 << 5)) m |= TRACE_BITS.SPRINT;
  if (h & (1 << 7)) m |= TRACE_BITS.HEAL;
  if (h & (1 << 9)) m |= TRACE_BITS.LOCK_TOGGLE;
  if (h & (1 << 10)) m |= TRACE_BITS.TWO_HAND;
  return m;
}

function r1(v) { return Math.round(v * 10) / 10; }
function r2(v) { return Math.round(v * 100) / 100; }
function r3(v) { return Math.round(v * 1000) / 1000; }
function r4(v) { return Math.round(v * 1e4) / 1e4; }
