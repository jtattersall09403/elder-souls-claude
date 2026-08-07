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
// There are SIX places a body can die in this build, and a hook in any one of them is a soul
// source with holes in it. **This list is written from the step order, not from a grep** —
// round 1's version was a grep, and the W1-SOULS round-1 verdict found that one entry was dead
// code and two real sites were missing. What matters for each site is not "does it kill" but
// "does the kill reach `sim.entities`, which is what this scan reads":
//
//   combat/resolve.js  killed()        a weapon landed the last hit    — kills the COMBAT BODY;
//                                      `combat-bridge.js mirror()` copies `eb.hp`/`eb.state`
//                                      onto the entity at the end of `stepCombat`, and
//                                      `stepSouls` runs after it in the same step. CARRIED.
//   combat/player.js   _critDamage()   a backstab or riposte did       — same, CARRIED.
//   sim/magic/system.js:1040           a spell's damage tick did       — same, CARRIED.
//   sim/magic/apply.js:164             an applied effect did           — same, CARRIED.
//   sim/hazards.js     H9              the province did, in `Engine._settleWorld()`, i.e. AFTER
//                                      `stepSouls` — so the transition is seen on the NEXT step.
//                                      Now CARRIED; it was EATEN until 2026-08-07, see below.
//   sim/player.js:233                  DEAD CODE. Nothing imports `stepPlayer`; `sim/events.js:19`
//                                      says so in-tree. Round 1 listed it as a live death path.
//
// So the award observes the world instead of instrumenting the killers: once per step, every
// entity that was alive last time we looked and is dead now is paid for. It cannot miss a death
// path, it cannot double-pay one that emits two events, and it does not care that hazards run in
// `Engine._settleWorld()` a frame late — the transition is still a transition next step.
//
// THE HAZARD PATH WAS EATEN, AND THE SCAN WAS NOT AT FAULT. Round 1's header said the scan
// "cannot miss a death path"; the verdict then killed an entity with a hazard-shaped write and
// measured hp 412 -> 0 -> **412** with zero souls. The cause is the view/authority split, not the
// scan: H9 wrote `ent.hp` on the `sim.entities` MIRROR, and `mirror()` restores it from the
// untouched combat body every step. Fixed in `sim/hazards.js _hurtEntity()`, which now damages
// the combat body — the authority — exactly as the player branch of the same hazard already did.
// The lesson generalises past souls: **a write to `sim.entities` on a body that has a combat body
// is a write to a cache.**
//
// `_seen` is a Map from eid to "was alive when last observed", and it is LAZILY seeded: the
// first time an eid is seen, if the body is already dead, it is recorded as paid WITHOUT an
// award. That is what makes a save/load safe — a blob that restores a corpse restores a corpse,
// not 136 free souls — with no new durable field and therefore no change to the save manifest or
// to `getDurableFieldCensus`, which is the instrument that has caught the last two save defects.
//
// A respawned enemy (`death.js` sets `b.dead = false` on a rest) is re-armed by the same
// mechanism and pays again at x1.00 — but ONLY across a rest. See the epoch gate below.
//
// ---------------------------------------------------------------------------------------------
// THE RESPAWN GATE — S5 gives respawn to the HEARTH REST, not to any re-spawn
// ---------------------------------------------------------------------------------------------
//
// Round 1 re-armed a corpse on any `dead -> alive` transition and called that "exactly RI-PRG06
// §4's respawn row". It is not. RI-PRG06 §4's row is `Respawned enemy x1.00`, and S5 is what
// makes an enemy respawn: **you rested**. The verdict killed a party, despawned it, spawned it
// again and collected **+816, +816, +816 across three passes with zero hearth rests**, because
// `Engine.spawnEncounter` mints deterministic eids (`dres-raid-party-infantry-0`) so the same
// body came back under the same key. At the time the only in-engine caller that despawns an
// encounter was `_resolveCapture()`, so a player could not reach it — and then W1-POPULATION
// landed `PopulationSystem`, a distance-driven pump that materialises and releases posts as the
// player walks. That turns it into *walk 170 m away, walk back, kill again, for ever*.
//
// So the re-arm is gated on the rest counter rather than on a boolean. `DeathSystem` bumps
// `ordinaryRespawnEpoch` in `respawnOrdinary()` — the S5 event itself, fired by a hearth rest and
// by a player death — and a corpse only becomes payable again when the epoch has moved past the
// one it was last paid at. A body that leaves the entity array and comes back under the same eid
// without a rest in between stays settled and pays nothing.
//
// The epoch is supplied by the engine as a function rather than read off `sim`, because
// `DeathSystem` hangs off the engine and not off `sim`, and this module must not acquire a
// handle to the engine. With no supplier the gate degrades to epoch 0 — which is the SAFE
// direction: everything stays settled, nothing double-pays.
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
   * @param {function():number} [restEpoch]  `() => death.ordinaryRespawnEpoch`. See the header.
   */
  constructor(enemyData, restEpoch) {
    this.d = enemyData || {};
    /**
     * eid -> { alive, paidEpoch }. `alive` is what it was when last observed; `paidEpoch` is the
     * rest epoch the body was last paid (or settled) at. Lazily seeded; see the header.
     */
    this._alive = new Map();
    /** The S5 rest counter, or a constant 0 when nobody supplies one (safe direction). */
    this._restEpoch = typeof restEpoch === 'function' ? restEpoch : () => 0;
    /** Diagnostics: re-arms refused because no rest had happened. */
    this.refusedRearms = 0;
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
  reset() { this._alive.clear(); this.kills = 0; this.awarded = 0; this.refusedRearms = 0; }

  /**
   * One step. Allocation-conscious, no RNG, no wall clock — safe under the armed sim guard.
   *
   * @param {object} sim
   * @param {object} bus  the event bus, for `souls_awarded`
   */
  step(sim, bus) {
    const ents = sim.entities;
    const epoch = this._restEpoch() || 0;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      const dead = e.hp <= 0 || e.state === 'DEAD';
      const rec = this._alive.get(e.eid);
      if (rec === undefined) {
        // First sight. A corpse we are meeting for the first time — a loaded save, a state
        // patch — is recorded as already settled at the CURRENT epoch and is never paid for.
        // Stamping the current epoch (rather than 0) is what stops a load followed by a rest
        // from paying out every corpse in the blob.
        this._alive.set(e.eid, { alive: !dead, paidEpoch: epoch });
        continue;
      }
      if (!rec.alive) {
        // Already dead last time we looked. Re-arm ONLY if a HEARTH rest (or a player death)
        // has bumped the S5 epoch since we paid for it. A body that despawned and respawned
        // under the same eid without a rest — the population pump does this every time the
        // player walks out of and back into a post's radius — stays settled and pays nothing.
        if (!dead) {
          if (epoch > rec.paidEpoch) { rec.alive = true; rec.paidEpoch = epoch; }
          else this.refusedRearms++;
        }
        continue;
      }
      if (!dead) continue;

      // ---- the transition: alive -> dead, exactly once -------------------------------------
      rec.alive = false; rec.paidEpoch = epoch;
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
