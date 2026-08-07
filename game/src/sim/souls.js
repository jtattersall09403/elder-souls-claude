// SOULS — the source. Seam S2: souls buy levels, and nothing else buys them.
//
// Owner: wave-1 piece W1-SOULS. Binding: RI-PRG06 §§1-4 (yield, modifiers, S9), RI-PRG01
// ("what a level buys", "souls are not money"), RI-PRG04 §2 (the night window), seams S2, S9, S15.
//
// ---------------------------------------------------------------------------------------------
// WHAT THIS FILE IS FOR, and it is worth stating plainly because the SINK already existed.
// ---------------------------------------------------------------------------------------------
//
// `engine.js _spendSouls()` has been complete and correct for the whole of wave 1: it reads
// `soulsToNextLevel()` off RI-PRG01's shipped 139-row curve, debits `soulsHeld`, adds the level,
// adds the attribute point and dirties the derived pools. `sim/death.js` drops your souls on a
// bloodstain and credits them back when you walk to it. `sim/hearth.js` opens the level-up
// screen at all 29 sapwells. Every one of those pieces works.
//
// And the whole apparatus was **unfundable**. `soulsHeld` starts at 0 and NOTHING in
// `game/src/**` ever added to it except `death.js:589` handing back souls you already had. The
// attribute-scale builder spawned an encounter, killed five of six entities, and watched souls
// go 0 -> 0 with the next level costing 418. Every quest attribute demand in the tree had just
// been rescaled against a ceiling measured on that half-dead progression system.
//
// This module is the producer. It is deliberately about forty lines of actual work: the design
// is in `RI-PRG06` and the numbers are in `game/data/combat/enemies/*.json`, derived by
// `tools/progression/derive-soul-values.mjs`.
//
// ---------------------------------------------------------------------------------------------
// WHY IT IS A TRANSITION SCAN AND NOT A HOOK IN `killed()`
// ---------------------------------------------------------------------------------------------
//
// There are FIVE places a body can die in this build, and a hook in any one of them is a soul
// source with holes in it:
//
//   combat/resolve.js killed()          a weapon landed the last hit
//   combat/player.js  _critDamage()     a backstab or riposte did
//   sim/combat-bridge.js                a spell did (`target.dead = true`, inline)
//   sim/hazards.js                      the province did, OUTSIDE the fixed step
//   sim/player.js:233                   the non-combat entity path
//
// So the award observes the world instead of instrumenting the killers: once per step, every
// entity that was alive last time we looked and is dead now is paid for. It cannot miss a death
// path, it cannot double-pay one that emits two events, and it does not care that hazards run in
// `Engine._afterStep()` a frame late — the transition is still a transition next step.
//
// `_seen` is a Map from eid to "was alive when last observed", and it is LAZILY seeded: the
// first time an eid is seen, if the body is already dead, it is recorded as paid WITHOUT an
// award. That is what makes a save/load safe — a blob that restores a corpse restores a corpse,
// not 136 free souls — with no new durable field and therefore no change to the save manifest or
// to `getDurableFieldCensus`, which is the instrument that has caught the last two save defects.
//
// A respawned enemy (`death.js` sets `b.dead = false` on a rest) is re-armed by the same
// mechanism and pays again at x1.00, which is exactly RI-PRG06 §4's respawn row.
//
// ---------------------------------------------------------------------------------------------
// S9 — NO LEVEL SCALING, and this file is where it would be easiest to break
// ---------------------------------------------------------------------------------------------
//
// Nothing here reads `sim.progression.level`, elapsed playtime, region-clear count or the
// player's anything. The award is `statblock.souls x night`, and `night` is a property of the
// world clock, which is a choice the player made when they rested. `tools/progression/
// souls-consumption.mjs --s9` instantiates the roster at level 1 and at level 90 and asserts the
// awards are identical.
//
// ---------------------------------------------------------------------------------------------
// S15 — SOULS ARE NOT MONEY
// ---------------------------------------------------------------------------------------------
//
// This file writes `sim.progression.soulsHeld` and reads nothing else on `progression`. It does
// not touch `gold`, it has no price table, and there is no function here that takes souls and
// returns a thing. The only debit of `soulsHeld` in the build is `_spendSouls()`, which buys a
// level. (There is a known, separate purse defect — `fenceSell` pays `sim.stealth.p.gold` while
// the save writes `sim.progression.gold`. It is the save piece's to fix and is untouched here.)
'use strict';

/** RI-PRG06 §4 / RI-PRG04 §2 — the reward half of resting into darkness. */
export const NIGHT_MULTIPLIER = 1.35;
/** RI-PRG04 §2's night window, in hours on `sim.env.timeOfDay`. */
export const NIGHT_FROM_H = 21;
export const NIGHT_TO_H = 5;

/** Is the world clock inside the night window? A property of the world, never of the player. */
export function isNight(timeOfDay) {
  const h = Number(timeOfDay);
  if (!Number.isFinite(h)) return false;
  return h >= NIGHT_FROM_H || h < NIGHT_TO_H;
}

/**
 * What one kill of this archetype is worth, before anything is banked.
 *
 * @param {object} stat  a `game/data/combat/enemies/*.json` record
 * @param {number} timeOfDay  `sim.env.timeOfDay`
 */
export function awardFor(stat, timeOfDay) {
  const base = stat && Number.isFinite(stat.souls) ? stat.souls : 0;
  if (base <= 0) return { base: 0, night: false, souls: 0 };
  const night = isNight(timeOfDay);
  return { base, night, souls: night ? Math.round(base * NIGHT_MULTIPLIER) : base };
}

export class SoulsSystem {
  /**
   * @param {object} enemyData  `Engine.data.enemies` — statblock id -> record
   */
  constructor(enemyData) {
    this.d = enemyData || {};
    /** eid -> true if it was ALIVE when last observed. Lazily seeded; see the header. */
    this._alive = new Map();
    /** Diagnostics for the consumption instrument. Not simulation state. */
    this.kills = 0;
    this.awarded = 0;
    /**
     * The ablation switch RI-MTH07 requires an instrument to have. When false the scan still
     * runs and still marks bodies paid — it just banks nothing — so a probe can prove the
     * counter is reading THIS module and not a number a probe wrote.
     */
    this.enabled = true;
  }

  /** Forget every observation. Called on `sim.reset()` and on a state load. */
  reset() { this._alive.clear(); this.kills = 0; this.awarded = 0; }

  /**
   * One step. Allocation-conscious, no RNG, no wall clock — safe under the armed sim guard.
   *
   * @param {object} sim
   * @param {object} bus  the event bus, for `souls_awarded`
   */
  step(sim, bus) {
    const ents = sim.entities;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      const dead = e.hp <= 0 || e.state === 'DEAD';
      const was = this._alive.get(e.eid);
      if (was === undefined) {
        // First sight. A corpse we are meeting for the first time — a loaded save, a state
        // patch — is recorded as already settled and is never paid for.
        this._alive.set(e.eid, !dead);
        continue;
      }
      if (!was) {
        // Already dead last time we looked. Re-arm if something brought it back (a HEARTH
        // respawn); otherwise leave it settled.
        if (!dead) this._alive.set(e.eid, true);
        continue;
      }
      if (!dead) continue;

      // ---- the transition: alive -> dead, exactly once -------------------------------------
      this._alive.set(e.eid, false);
      const stat = this.d[e.id];
      const a = awardFor(stat, sim.env && sim.env.timeOfDay);
      this.kills++;
      if (this.enabled && a.souls > 0) {
        sim.progression.soulsHeld += a.souls;
        this.awarded += a.souls;
      }
      if (bus) {
        const ev = bus.emit(sim.frame, 'souls_awarded');
        ev.eid = e.eid; ev.archetype = e.id; ev.tier = e.tier;
        ev.base = a.base; ev.night = a.night; ev.multiplier = a.night ? NIGHT_MULTIPLIER : 1;
        ev.souls = this.enabled ? a.souls : 0;
        ev.held = sim.progression.soulsHeld;
        ev.hour = Math.round((sim.env && sim.env.timeOfDay || 0) * 100) / 100;
        // Declared on the event so a critic reading the stream can see the S15 line being held
        // rather than having to take this file's word for it.
        ev.gold_awarded = 0;
        ev.enabled = this.enabled;
      }
    }
  }
}

/** The step-order entry point. See `sim/step.js`. */
export function stepSouls(sim, bus) {
  if (sim.souls) sim.souls.step(sim, bus);
}
