// Skills that improve by use — the reading half of RI-PRG03.
//
// Owner: W1-07. The round-1 verdict: "A Salt-Blade Dunmer (Blades 25), locked on, swinging
// for 3,600 frames: 46 `attack_start`, 42 `WHIFF`, **4 `HIT`**, 2 `STAGGER`, **1 enemy
// `DEATH`**. Afterwards, Blades is 25 and every one of the other eighteen skills is
// byte-identical to its creation value."
//
// This module watches the event bus for the frame that has just been resolved and banks
// progress for the events RI-PRG03 §3 prices. It is deliberately an OBSERVER: it reads the
// same events a critic reads out of `trace.jsonl`, so anything it credits is visible in the
// artifact, and it cannot credit anything the fight did not actually emit. That is also what
// makes seam S1 safe — nothing here can reach the hit test, because by the time it runs the
// hit test has already happened and produced an event.
//
// The Cost Gate (RI-PRG03 §4) is enforced in derive.js `skillProgressFor`, on the observed
// cost rather than on the event's name: a `WHIFF` never reaches here, and a `HIT` carries the
// damage it dealt, so a hit that consumed nothing would be refused too.
'use strict';

import { skillProgressFor, bankProgress } from './derive.js';

/** skill id -> governing attribute, from game/data/progression/skills.json. */
export function governingMap(data) {
  const out = Object.create(null);
  for (const s of data.skills.skills) out[s.id] = s.governing;
  return out;
}

/**
 * One fixed step of progression. Called from stepOnce AFTER the fight, with the bus holding
 * this frame's events.
 *
 * @param {SimState} sim
 * @param {CombatSystem} combat
 * @param {EventBus} bus
 * @param {object} chData   the W1-07 data view (for the governing map)
 */
export function stepSkillUse(sim, combat, bus, chData) {
  const prog = sim.progression;
  if (!sim.character || !prog || !prog.skills) return;
  const p = combat && combat.player;
  if (!p) return;
  const weaponClass = p.moves && p.moves._classKey;
  const governingOf = sim._governingOf || (sim._governingOf = ((m) => (id) => m[id])(governingMap(chData)));

  // Snapshot the count BEFORE banking: bankProgress emits, and an event emitted here must
  // not be re-read as an input on the same pass.
  const n = bus.count;
  for (let i = 0; i < n; i++) {
    const e = bus.pool[i];
    let kind = null, ctx = null;
    switch (e.type) {
      case 'HIT':
        if (e.src !== p.id) break;
        kind = 'weapon_hit';
        ctx = { cost: e.dmg > 0 ? e.dmg : 0, weapon_class: weaponClass };
        break;
      case 'CRIT_HIT':
        if (e.src !== p.id) break;
        kind = (e.kind === 'riposte' || /riposte/.test(String(e.kind))) ? 'riposte' : 'backstab';
        ctx = { cost: e.dmg > 0 ? e.dmg : 0, weapon_class: weaponClass };
        break;
      case 'BLOCK':
        if (e.dst !== p.id) break;
        kind = 'shield_absorb';
        ctx = { cost: e.stam_cost > 0 ? e.stam_cost : 0 };
        break;
      case 'PARRY':
        // `who` is the body that WAS parried, so the parrier is the player when it is not.
        if (e.who === p.id) break;
        kind = 'parry';
        ctx = { cost: 1 };
        break;
      case 'spell_hit':
      case 'effect_apply':
        if (e.by !== undefined && e.by !== p.id) break;
        kind = 'cast_effective';
        ctx = { cost: e.focus_spent || e.dmg || 1, spell_skill: e.skill || 'sorcery' };
        break;
      default: break;
    }
    if (!kind) continue;
    const g = skillProgressFor(kind, ctx);
    if (!g || !g.skill || g.points <= 0) {
      if (g && g.refused) {
        const ev = bus.emit(sim.frame, 'skill_use');
        ev.skill = g.skill; ev.event = kind; ev.points = 0; ev.refused = g.refused;
      }
      continue;
    }
    const r = bankProgress(prog, g.skill, g.points, governingOf);
    const ev = bus.emit(sim.frame, 'skill_use');
    ev.skill = r.skill; ev.event = kind; ev.points = r.granted;
    ev.value = r.value; ev.from = r.from; ev.progress = r.progress; ev.to_next = r.to_next;
    ev.consumed = g.consumes;
    if (r.gained) { ev.levelled = r.gained; }
    if (r.attributes_granted && r.attributes_granted.length) {
      for (const a of r.attributes_granted) {
        const le = bus.emit(sim.frame, 'level_up');
        le.stream = 'earned'; le.attribute = a.attribute; le.to = a.to; le.because = `${r.skill} reached ${a.at_skill}`;
        sim._poolsDirty = true;
      }
    }
  }
}

/**
 * Progress that does not arrive as a combat event: the out-of-fight half of §3's table.
 * Called by the engine's verbs (barter, lockpick, persuade, harvest) rather than per frame.
 */
export function grantUse(sim, bus, chData, kind, ctx) {
  const prog = sim.progression;
  if (!sim.character || !prog || !prog.skills) return { refused: 'no character' };
  const governingOf = sim._governingOf || (sim._governingOf = ((m) => (id) => m[id])(governingMap(chData)));
  const g = skillProgressFor(kind, ctx || {});
  if (!g || !g.skill) return { refused: (g && g.refused) || `unknown use event '${kind}'` };
  if (g.points <= 0) return { skill: g.skill, granted: 0, refused: g.refused || 'cost_gate' };
  const r = bankProgress(prog, g.skill, g.points, governingOf);
  if (bus) {
    const ev = bus.emit(sim.frame, 'skill_use');
    ev.skill = r.skill; ev.event = kind; ev.points = r.granted; ev.value = r.value;
    ev.from = r.from; ev.progress = r.progress; ev.to_next = r.to_next; ev.consumed = g.consumes;
    for (const a of r.attributes_granted || []) {
      const le = bus.emit(sim.frame, 'level_up');
      le.stream = 'earned'; le.attribute = a.attribute; le.to = a.to; le.because = `${r.skill} reached ${a.at_skill}`;
    }
  }
  if (r.attributes_granted && r.attributes_granted.length) sim._poolsDirty = true;
  return r;
}
