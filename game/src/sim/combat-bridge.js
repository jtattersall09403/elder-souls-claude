// The bridge between W1-09's combat core and W1-00's simulation/save/trace state.
//
// W1-00 owns `sim.player` and `sim.entities`: they are what the save projects, what the
// durable-field census walks, what the renderer draws and what `elder-souls/trace@1` reports.
// W1-09 owns the FIGHT, and its authority lives in `CombatSystem`'s bodies, which carry a rig,
// a move, a poise pool and a swept weapon capsule that the W1-00 records have no field for.
//
// Rather than widen the save schema (and silently break `getDurableFieldCensus`, which is the
// instrument that caught the last two save defects), the combat bodies are the AUTHORITY and
// `sim.player` / `sim.entities` are a VIEW, refreshed at the bottom of every step. Every field
// W1-00 declared still means what it meant; the fields W1-09 added live in the combat trace,
// which is a second stream from the same run — exactly the arrangement RI-CMB07 §A already
// specifies for the RI-AI01 enemy stream.
//
// DECLARED CONSEQUENCE: mid-animation combat state is NOT durable. A save taken on frame 12 of
// a roll restores a standing character at the roll's position. That is the correct behaviour
// under seam S6 (you save by resting at a Hist-stump) and it matches both source games, but it
// is a real limitation and it is written here rather than discovered by a critic.
'use strict';

import { rng } from '../core/rng.js';
import { BIT } from '../input/actions.js';

export function stepCombat(sim, input, combat, bus) {
  const frame = sim.frame;

  // The one seeded draw in the simulation, kept exactly where W1-00 put it and for the same
  // reason (GAP-W1-platform-prng-never-drawn): a per-entity idle phase offset, drawn INSIDE
  // the fixed step on the entity's first simulated frame, so `rng.draws` moves in every trace.
  for (let i = 0; i < sim.entities.length; i++) {
    const e = sim.entities[i];
    if (e.animPhase0 < 0) {
      e.animPhase0 = rng.int(e.animLen > 1 ? e.animLen : 1);
      const b = combat.bodyOf(e.eid);
      if (b) b._loopFrame = e.animPhase0;
    }
  }

  // Lock-on is a free action at any stamina (RI-CMB03 §B) and is resolved before the fight.
  if (input.pressed & BIT.lock_on) combat.toggleLock(frame, sim.camera.yaw, bus);

  combat.step(frame, input, sim.camera, bus, sim);
  mirror(sim, combat);
}

/** Refresh the W1-00 view from the W1-09 authority. Allocation-conscious: arrays are reused. */
export function mirror(sim, combat) {
  const b = combat.player;
  const p = sim.player;
  if (!b) return;
  p.pos[0] = b.pos[0]; p.pos[1] = b.pos[1]; p.pos[2] = b.pos[2];
  p.yaw = b.yaw;
  p.state = b.state;
  p.anim = b.anim;
  p.animFrame = b.animFrame;
  p.animLen = b.move ? b.move.total : 1;
  p.phase = phaseOf(b);
  p.hp = Math.max(0, b.hp);
  p.hpMax = b.hpMax;
  p.stamina = b.stamina;
  p.staminaMax = b.staminaMax;
  p.regenBlockUntil = b.regenBlockUntil;
  p.poise = Math.max(0, b.poiseHealth);
  p.poiseMax = b.poiseHealthMax;
  p.iframe = b.iframe;
  p.iframeKind = b.iframeKind;
  p.speedMps = b.speedMps;
  p.moveDirDeg = b.moveDirDeg;
  p.equipLoadPct = b.equipLoadPct;
  p.rollClass = b.tier;
  p.actionableAt = b.actionableAt;
  p.estus = combat.playerCtl ? combat.playerCtl.estus : p.estus;
  p.lockOn = combat.lock.target;
  p.move = b.move ? b.move.id : null;
  p.moveData = b.move;
  p.swingSeq = b.swingSeq;
  p.hitboxes.length = 0;
  if (b.hitboxActive && b.move) {
    p.hitboxes.push({
      id: `wpn_${b.move.id}`, owner: 'player', kind: 'capsule',
      a: [r4(b.socketA[0]), r4(b.socketA[1]), r4(b.socketA[2])],
      b: [r4(b.socketB[0]), r4(b.socketB[1]), r4(b.socketB[2])],
      prev_a: [r4(b.prevA[0]), r4(b.prevA[1]), r4(b.prevA[2])],
      prev_b: [r4(b.prevB[0]), r4(b.prevB[1]), r4(b.prevB[2])],
      r: b.move.hitbox_radius_m,
      active_f: b.animFrame - b.move.startup,
      dmg: { phys: Math.round((b.move.motion_value || 1) * b.moves._weapon.attack_rating) },
      poise_dmg: b.move.poise_damage || 0,
      hits: [...b.hitThisSwing],
      substeps: combat.d.hitgeometry.sweep.substeps,
    });
  }

  for (let i = 0; i < sim.entities.length; i++) {
    const e = sim.entities[i];
    const eb = combat.bodyOf(e.eid);
    if (!eb) continue;
    const ec = combat.enemies.get(e.eid);
    e.pos[0] = eb.pos[0]; e.pos[1] = eb.pos[1]; e.pos[2] = eb.pos[2];
    const prev = e.state;
    e.state = eb.state;
    e.anim = eb.anim;
    e.animFrame = eb.animFrame;
    e.animLen = eb.move ? eb.move.total : (e.animLen || 1);
    e.phase = phaseOf(eb);
    e.yaw = eb.yaw;
    e.hp = Math.max(0, eb.hp);
    e.poise = Math.max(0, eb.poiseHealth);
    e.poiseMax = eb.poiseHealthMax;
    e.stagger = !!(eb.move && eb.move.kind === 'stagger');
    e.staggerUntil = eb.staggerUntil;
    e.hitActive = eb.hitboxActive;
    e.alert = ec ? ec.alert : e.alert;
    e.alertState = ec ? ec.alertState : e.alertState;
    e.hitboxes.length = 0;
    if (eb.hitboxActive && eb.move) {
      e.hitboxes.push({
        id: `e_${eb.move.id}`, owner: e.eid, kind: 'capsule',
        a: [r4(eb.socketA[0]), r4(eb.socketA[1]), r4(eb.socketA[2])],
        b: [r4(eb.socketB[0]), r4(eb.socketB[1]), r4(eb.socketB[2])],
        prev_a: [r4(eb.prevA[0]), r4(eb.prevA[1]), r4(eb.prevA[2])],
        prev_b: [r4(eb.prevB[0]), r4(eb.prevB[1]), r4(eb.prevB[2])],
        r: eb.move.hitbox_radius_m,
        active_f: eb.animFrame - eb.move.startup,
        dmg: { phys: Math.round((eb.move.motion_value || 1) * eb.moves._weapon.attack_rating) },
        poise_dmg: eb.move.poise_damage || 0,
        hits: [...eb.hitThisSwing],
        substeps: combat.d.hitgeometry.sweep.substeps,
      });
    }
    if (prev !== e.state) { e.prevState = prev; e.stateEnteredF = sim.frame; }
  }
}

function phaseOf(b) {
  if (b.hitstop) return 'hitstun';
  if (!b.move) return 'none';
  const m = b.move;
  if (m.kind === 'stagger' || m.kind === 'guard_break') return 'hitstun';
  if (b.animFrame <= m.startup) return 'windup';
  if (b.animFrame <= m.startup + m.active) return 'active';
  if ((m.kind === 'roll' || m.kind === 'backstep') && b.animFrame > m.hard_until) return 'turn';
  return 'recovery';
}

function r4(v) { return Math.round(v * 1e4) / 1e4; }
