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
// ---------------------------------------------------------------------------------------------
// WHAT THE LEDGER IS KEYED ON, AND WHY IT IS NOT THE ENTITY ID
// ---------------------------------------------------------------------------------------------
//
// **ROUND 3. This is the whole of `GAP-W1-souls-alive-keyed-on-eid`, and it had three faces
// before anybody called it a class.** Rounds 1 and 2 keyed the ledger on `e.eid` and asked
// "have I seen this NAME before, at this rest epoch". Both halves of that key are minted by
// somebody else and reset independently of the bodies they describe — the eid by whoever
// spawns, the epoch by `DeathSystem`, the ledger by whoever remembers to clear it — and there
// was no invariant tying the three together. So it broke three times, in two directions:
//
//   1. `Engine.applyNamedState()` cleared four subsystems and not this one, so the SAME fight
//      across a scenario boundary paid `+384` and then `+0` with twelve refused re-arms and
//      zero rests. (W1-SOULS-r2 HF-1, measured.)
//   2. `PopulationSystem` releases a post the player only PARTLY cleared and re-materialises it
//      under `{ tag: p.id }` — the post id, stable by construction — so five corpses' eids came
//      back on five live, full-HP, hostile bodies and the ledger refused to pay for any of
//      them. Five real enemies worth nothing. (W1-SOULS-r2 HF-2, measured.)
//   3. `Engine.loadState(blob)` DID clear the ledger, while `ordinaryRespawnEpoch` did not move
//      and `PopulationSystem.reset()` put every post back to DORMANT — so kill a post, save,
//      load, kill it again paid in full, without bound, with no rest.
//      (W1-POPULATION-r1 §2 / `GAP-W1-population-save-reload-repays-every-corpse`, measured by
//      that piece's critic, on a route nobody here had tried.)
//
// Faces 2 and 3 pull in OPPOSITE directions off the same key. That is not three bugs with a
// shared cause; it is the proof that the key was wrong rather than that the sign was wrong.
//
// **So the ledger is keyed on the BODY, not on the name.** `_alive` still maps eid -> record for
// O(1) lookup, but the record holds `ref`, the entity object `sim/entities.js makeEntity()`
// minted. Object identity is the one notion of "this body" in the build that nothing can
// counterfeit: `sim.reset()` throws the array away, `despawn()` splices the object out,
// `applySave()` rebuilds every record through `statFor`, and `spawnEncounter` builds a NEW
// object even when it re-uses the name. So:
//
//   * a record whose `ref` is not the entity in front of us is about a body that no longer
//     exists. The entity in front of us is a NEW LIFE and is seeded from scratch — alive if it
//     is alive, and paid for when it dies. Face 2 closes structurally: there is no name left to
//     recycle.
//   * the ledger can no longer outlive the world it describes, because its entries are about
//     objects the boundary destroyed. Face 1 closes structurally too, and the
//     `_resetSessionObservers()` line the engine now calls at both boundaries is hygiene rather
//     than the mechanism — which is what it should always have been.
//   * face 3 is NOT a defect in this file and this file must stop pretending it can fix one.
//     The ledger pays once per body-life; a save and a load handed the player a province full
//     of newly built bodies, and paying for bodies the world built is exactly what this module
//     is for. **The price of a respawn is the world's to charge, not the reward's to refuse.**
//     Round 2's epoch gate was this module compensating for a world that rebuilds bodies for
//     free, and that is precisely why it broke in the opposite direction on the first route
//     nobody had tried. A fourth route will exist; it must break the WORLD's invariant, where
//     it can be seen, and not be silently absorbed here. `tools/progression/souls-ledger-oracle.mjs`
//     asserts all three invariants over arbitrary event sequences for that reason.
//
// **HOW LOAD-BEARING IS THIS, MEASURED RATHER THAN ASSERTED — AND THE ANSWER IS "NOT VERY, TODAY".**
// `tools/progression/souls-ledger-oracle.mjs` was re-run with this key REMOVED (back to round 2's
// `if (rec === undefined)`) over all 343 exhaustive length-3 world routes, and it came back
// **GREEN on all three invariants**. That is not a typo and it is not buried: with the boundary
// registry clearing the ledger at both scenario boundaries, and with `world/population.js` no
// longer resurrecting the dead at a released post, **there is currently no route in that set on
// which a recycled eid reaches this scan attached to a live body**. The same ablation on the
// world's register (`population.js`'s `down`) goes RED on 11 counts across 2 routes, including
// HF-2's own `kill_some > release > materialise` — so of the three changes, that is the one
// carrying the class today.
//
// This key is therefore **defence in depth and is described as such**, not as the mechanism. It is
// kept because the two fixes that currently cover it are both somebody remembering something — a
// list to be added to, and a register to be maintained — and this one is a property of the data
// structure that holds whether or not anybody remembers. The next subsystem that learns to rebuild
// a body (a dungeon reset, a quest re-staging an ambush, a region streamed out and back) pays
// correctly without having to know this file exists. An honest claim about a redundant guard is
// worth more than an inflated claim about a load-bearing one.
//
// LAZY SEEDING is unchanged and still carries the save. The first time a body-life is seen, if
// it is already dead it is recorded as settled and never paid: a blob that restores a corpse
// restores a corpse, not 136 free souls. No new durable field, so no change to the save
// manifest and none to `getDurableFieldCensus`, the instrument that caught the last two save
// defects. `ref` is a live object reference held only in this Map; at most one stale entity
// record is pinned per distinct eid, and the eid namespace is bounded by the post table (tags
// are post ids, stable by construction), so the retention is bounded and does not grow with
// session length.
//
// ---------------------------------------------------------------------------------------------
// THE REST EPOCH — what is left of it, and it is now doing exactly one job
// ---------------------------------------------------------------------------------------------
//
// There is exactly ONE way a body comes back as the SAME object in this build:
// `sim/death.js respawnOrdinary()` sets `e.hp = e.hpMax` in place on the entities that are still
// in the array. That is the S5 event — a hearth rest or a player death — and `RI-PRG06` §4's
// `Respawned enemy x1.00` row is about it. So the epoch gate survives, scoped to the case it was
// always about: a record whose `ref` still matches, whose body was dead and is alive again, is
// re-armed only if `ordinaryRespawnEpoch` has moved past the epoch it was paid at.
//
// It no longer has any opinion about bodies that were rebuilt, because it cannot see one and
// should not: a rebuilt body is a different body.
//
// The epoch is supplied by the engine as a function rather than read off `sim`, because
// `DeathSystem` hangs off the engine and not off `sim`, and this module must not acquire a
// handle to the engine. With no supplier the gate degrades to epoch 0 — which is the SAFE
// direction for the one case it still governs: a revived corpse stays settled.
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
     * eid -> { ref, alive, paidEpoch }.
     *
     * `ref` is THE BODY — the entity object `makeEntity()` minted — and it is what the record is
     * really keyed on; the eid is only the index into the Map. `alive` is what that body was
     * when last observed; `paidEpoch` is the rest epoch it was last paid (or settled) at.
     * Lazily seeded. See the header: keying this on the eid alone is `GAP-W1-souls-alive-keyed-
     * on-eid` and it failed in both directions.
     */
    this._alive = new Map();
    /** The S5 rest counter, or a constant 0 when nobody supplies one (safe direction). */
    this._restEpoch = typeof restEpoch === 'function' ? restEpoch : () => 0;
    /** Diagnostics: re-arms refused because no rest had happened. Revived bodies only. */
    this.refusedRearms = 0;
    /**
     * Diagnostics: how many times a name was seen carrying a body that was not the body the
     * ledger had under it. Non-zero is normal (a scenario boundary, a released post coming
     * back); it is here so an instrument can tell "a new body" from "the same body" without
     * having to reach into the Map.
     */
    this.rebuilds = 0;
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

  /**
   * Forget every observation. Called by `Engine._resetSessionObservers()` at BOTH scenario
   * boundaries — the named-state path and the blob path — which is one list rather than the two
   * hand-maintained ones this call was missing from.
   *
   * Since round 3 this is hygiene and not the mechanism: the ledger is keyed on the body, so a
   * boundary that failed to call it would still not mis-pay. It is called anyway, because a
   * ledger about a world that no longer exists is a ledger that grows for no reason, and because
   * `refusedRearms`/`rebuilds` are per-session diagnostics that a scenario boundary must zero
   * for the next scenario's instrument to mean anything.
   */
  reset() {
    this._alive.clear();
    this.kills = 0; this.awarded = 0; this.refusedRearms = 0; this.rebuilds = 0;
  }

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
      // `rec.ref !== e` is a body wearing a name the ledger has a record for. It is a DIFFERENT
      // BODY — `sim.reset()`, `despawn()`, `applySave()` and `spawnEncounter` all mint a fresh
      // object, and only `death.js respawnOrdinary()` brings the same one back — so the record
      // is about something that no longer exists and is replaced rather than consulted.
      if (rec === undefined || rec.ref !== e) {
        // First sight OF THIS BODY. A corpse we are meeting for the first time — a loaded save,
        // a state patch, a post re-materialised with its dead still down — is recorded as
        // already settled at the CURRENT epoch and is never paid for. Stamping the current epoch
        // (rather than 0) is what stops a load followed by a rest from paying out every corpse
        // in the blob.
        if (rec !== undefined) this.rebuilds++;
        this._alive.set(e.eid, { ref: e, alive: !dead, paidEpoch: epoch });
        continue;
      }
      if (!rec.alive) {
        // The SAME body, dead last time we looked, and it is upright again. There is exactly one
        // way that happens: `sim/death.js respawnOrdinary()` revived it in place, which is the S5
        // event. Re-arm only if a HEARTH rest (or a player death) has bumped the epoch since we
        // paid for it — `RI-PRG06` §4's `Respawned enemy x1.00` row, and nothing else.
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
      // W1-13 round 4, AR-1. NOT `env.timeOfDay` — the AWARD clock. `sim/environment.js` §1b
      // holds the world clock while a death is in flight (RI-PRG04 §6 rule 4, so dying at a boss
      // cannot burn a quest deadline) and that made the frames a player spends dead free of night
      // time: from 04:30, forty deaths left this same enemy paying 57 where forty deaths' worth of
      // frames spent ALIVE left it paying 42. A death that pays 35% more is loss compensation and
      // AR-1 forbids it. `awardTimeOfDay` ticks whether the player is alive or dead and is
      // re-seated on the world clock at every rest, so the rate follows elapsed world and not the
      // clock death freezes. The `||` fallback is the pre-environment-step case (a probe that
      // never stepped the world), where the two are equal by construction.
      const env = sim.env;
      const awardHour = env && Number.isFinite(env.awardTimeOfDay) ? env.awardTimeOfDay : (env && env.timeOfDay);
      const a = awardFor(stat, awardHour);
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
        // W1-13 r4: the hour the RATE was decided by, beside the hour the world reads. They differ
        // by exactly the time death has held the clock, and a critic reading the stream can see it.
        ev.award_hour = Math.round((awardHour || 0) * 100) / 100;
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
