#!/usr/bin/env node
// souls-consumption.mjs — the CONSUMPTION probe for the soul economy.
// RI-MTH07 §B, mandatory under ARBITRATION.md §3.
//
// ---------------------------------------------------------------------------------------------
// WHAT A SOUL COUNTER IS NOT ALLOWED TO BE
// ---------------------------------------------------------------------------------------------
//
// Thirteen subsystems in this project have shipped a correct, instrumented model that nothing in
// the running world reads, and the soul economy was one of them *in the other direction*: the
// SINK was live and complete (`_spendSouls()`, RI-PRG01's 139-row curve, the level-up screen at
// all 29 wells, the bloodstain) and the SOURCE did not exist. A probe that hands the player 4,200
// souls and then watches them spend correctly measures the probe.
//
// So no assertion in this file is allowed to pass by reading a number a probe wrote. Every claim
// is made twice — once with the mechanism intact and once with it broken on purpose — and a claim
// whose ablated arm does not go red is reported as UNFALSIFIABLE and fails the run.
//
//   A. THE SOURCE EXISTS.        Kill a real entity in the live world. Souls must rise.
//   B. ABLATION (the module).    `sim.souls.enabled = false`, kill again. Souls must NOT move.
//                                If A passes and B also passes, the counter is not reading
//                                `sim/souls.js` and A proves nothing.
//   C. DELETE-THE-FIX (the number). Set the shipped statblock's `souls` to 0 -> the kill pays 0.
//                                Set it to 999 -> the kill pays exactly 999. The number in
//                                `game/data/combat/enemies/*.json` is the number the world uses,
//                                and neither arm is a value this build ever ships.
//   D. PROPS ARE NOT A FARM.     `dummy_passive` has 99,999 hp and is hittable by design.
//                                Killing it must pay zero.
//   E. S9 — NO LEVEL SCALING.    The same kill at level 1 and at level 90 pays the same souls.
//   F. NIGHT x1.35 (RI-PRG06 §4).  14:00 pays base; 23:00 pays round(base x 1.35). The control
//                                is that the DAY arm does not move — a multiplier that is always
//                                on is not a multiplier.
//   G. THE LOOP, DRIVEN AS A PLAYER. Fight, earn, stand at a well, rest, open the level-up
//                                screen, drive it with real latched input, spend. The attribute
//                                must move, and the DERIVED POOL behind it must move too — that
//                                is the entity changing behaviour that RI-MTH07 asks for. Souls
//                                buying a number nobody's body reads would be the same defect
//                                one layer down.
//   H. THE SPEND SURVIVES A SAVE, AUDITED ON THE LIVE WORLD.  Save, load, and read
//                                `getPlayerStats()` and the COMBAT BODY after the load — not the
//                                blob. A field that is written and never read back re-serialises
//                                to exactly what was saved and passes a round-trip test forever.
//   I. NO DOUBLE PAY.            Kill, save, load, step. A restored corpse must not pay again.
//   J. S15 — SOULS ARE NOT MONEY.  Gold must not move across any of it, and the `souls_awarded`
//                                event must carry `gold_awarded: 0`.
//
// Run:  node tools/progression/souls-consumption.mjs [--out reports/souls-consumption.json]
// Exit: 0 all arms pass, 1 an arm failed, 2 the instrument could not run.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };

const out = { tool: 'souls-consumption', at: new Date().toISOString(), arms: {}, verdicts: [] };
const say = (s) => console.log(s);

const handle = await launchGame({ width: 320, height: 240 });
const page = handle.page;
page.on('pageerror', (e) => say(`  [pageerror] ${e.message}`));
try {
  await page.waitForFunction(() => !!window.__HARNESS && !!window.__ENGINE, null, { timeout: 90000 });
  await page.evaluate(() => window.__HARNESS.setRenderRate && window.__HARNESS.setRenderRate(0));

  const probe = await page.evaluate(async () => {
    const H = window.__HARNESS, E = window.__ENGINE;
    const R = {};
    // A REAL CHARACTER, not the placeholder six-attribute Souls sheet the engine carries before
    // the Writ House. Arm G measures whether a BOUGHT attribute reaches the body, and the body's
    // pools are derived from the ten-attribute sheet; against the placeholder there is nothing
    // for `vigour` to feed. This is the same signature the faction and attribute probes use.
    H.setCharacter({ race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' });
    H.stepFrames(2);
    // Arm J asserts against the TRACE, so there has to be one.
    H.traceStart({ events: true });
    H.traceDrain();
    const stats = () => H.getPlayerStats();
    const gold = () => E.sim.progression.gold;

    /**
     * Kill ONE live entity and report what the world did about it. Everything below goes
     * through this, so no arm can accidentally measure a different mechanism than another.
     */
    const killOne = (eid) => {
      const before = stats().souls, goldBefore = gold();
      // A body can go between the listing and the kill — the world clock keeps running and dead
      // bodies are cleaned up. Report that as a skipped kill rather than throwing: a probe that
      // crashes instead of failing tells a reader nothing, and the delete-the-fix arm is exactly
      // the run where a crash would be mistaken for the deletion working.
      if (!E.combat.bodyOf(String(eid))) {
        return { eid, skipped: 'no body at kill time', souls_before: before, souls_after: before,
          delta: 0, gold_before: goldBefore, gold_after: goldBefore, events: [] };
      }
      H.killEntity(eid);
      const evs = [];
      // The award is a post-step observer, so a frame has to actually run. Events are read off
      // the TRACE rather than off a return value, so what is asserted is what a critic would
      // find in `elder-souls/trace@1` rather than what this probe was handed.
      for (let i = 0; i < 4; i++) {
        H.stepFrames(1);
        for (const rec of H.traceDrain() || []) {
          for (const ev of rec.events || []) if (ev.type === 'souls_awarded') evs.push(ev);
        }
      }
      return { eid, souls_before: before, souls_after: stats().souls,
        delta: stats().souls - before, gold_before: goldBefore, gold_after: gold(), events: evs };
    };

    /**
     * A fresh encounter in front of the player, and the eids it produced.
     *
     * THE TAG IS LOAD-BEARING AND IT WAS NOT THERE IN ROUND 1. `spawnEncounter` mints eids as
     * `${tag || encounterId}-${role}-${i}`, so an untagged despawn/respawn cycle brings the SAME
     * SIX EIDS back. Round 1's twelve arms all ran on those six eids and all silently depended on
     * a corpse being re-payable with no hearth rest in between — which is the exact defect the
     * verdict charged as HF-3 and which `sim/souls.js`'s rest-epoch gate now refuses. The first
     * run of this suite after the gate landed scored 8/15 with C, E, F and G1-G3 all reading zero,
     * and the cause was the instrument, not the world: arm A had already consumed the bodies.
     *
     * A "fresh fight" means a DIFFERENT GROUP OF ENEMIES, so it gets a unique tag. Arm M is the
     * one place the reuse is the point, and it deliberately spawns untagged.
     */
    let fightSeq = 0;
    const freshFight = () => {
      for (const e of H.listEntities() || []) { try { H.despawn(e.eid || e.id); } catch { /* gone */ } }
      const p = stats().pos;
      H.spawnEncounter('dres-raid-party', p[0], p[2], { tag: `probe-fight-${++fightSeq}` });
      // ONE FRAME BEFORE ANYTHING DIES, and it is load-bearing rather than hygiene. The award
      // is a transition scan with lazy seeding: the first time it sees an eid it records
      // whether that body was alive, and a body it has NEVER seen alive is treated as already
      // settled and is never paid for. That is what stops a loaded save paying out its corpses
      // (arm I) — and it means a probe that spawns and kills inside the same frame measures the
      // seeding rule instead of the award. Round 1 of this probe did exactly that and read
      // `souls=0 -> +0, souls=999 -> +0` as a passing delete-the-fix.
      H.stepFrames(1);
      // ONLY BODIES THE FIGHT KNOWS ABOUT. `listEntities()` also returns scheduled NPCs, who
      // have a record and no combat body (`sim/npc.js`) — `killEntity` throws on one, which is
      // how a delete-the-fix run of this probe died with "no such body" instead of going red.
      // A probe that crashes instead of failing is not a probe.
      return (H.listEntities() || [])
        .map((e) => e.eid || e.id)
        .filter((x) => x && !!E.combat.bodyOf(String(x)));
    };

    // ---- A. THE SOURCE EXISTS ----------------------------------------------------------------
    H.setTimeOfDay(14);
    let eids = freshFight();
    R.A = { archetype: 'inf_trash', declared_souls: E.data.enemies.inf_trash.souls,
      entities: eids.length, level: stats().level, souls_to_next: stats().souls_to_next,
      souls_at_start: stats().souls, kills: [] };
    for (const eid of eids.slice(0, 4)) R.A.kills.push(killOne(eid));
    R.A.souls_at_end = stats().souls;
    R.A.level_at_end = stats().level;

    // ---- B. ABLATION: break the module and confirm the counter goes dead ----------------------
    E.sim.souls.enabled = false;
    eids = freshFight();
    R.B = { note: 'sim.souls.enabled = false — the scan still runs and still settles bodies, it just banks nothing', kills: [] };
    for (const eid of eids.slice(0, 3)) R.B.kills.push(killOne(eid));
    E.sim.souls.enabled = true;

    // ---- C. DELETE-THE-FIX ON THE NUMBER -----------------------------------------------------
    const shipped = E.data.enemies.inf_trash.souls;
    R.C = { shipped, arms: [] };
    for (const v of [0, 999]) {
      E.data.enemies.inf_trash.souls = v;
      eids = freshFight();
      R.C.arms.push({ set_to: v, kill: killOne(eids[0]) });
    }
    E.data.enemies.inf_trash.souls = shipped;
    eids = freshFight();
    R.C.restored = { set_to: shipped, kill: killOne(eids[0]) };

    // ---- D. PROPS ARE NOT A FARM -------------------------------------------------------------
    for (const e of H.listEntities() || []) { try { H.despawn(e.eid || e.id); } catch { /* gone */ } }
    const p = stats().pos;
    R.D = { declared_souls: E.data.enemies.dummy_passive.souls, hp: E.data.enemies.dummy_passive.hp };
    try {
      const d = H.spawn('dummy_passive', p[0] + 3, p[2] + 3, {});
      R.D.kill = killOne(d.eid || d);
    } catch (err) { R.D.error = String(err.message || err); }

    // ---- E. S9 — NO LEVEL SCALING ------------------------------------------------------------
    R.E = { arms: [] };
    for (const lvl of [1, 90]) {
      E.sim.progression.level = lvl;
      eids = freshFight();
      R.E.arms.push({ player_level: lvl, kill: killOne(eids[0]) });
    }
    E.sim.progression.level = R.A.level;

    // ---- F. NIGHT x1.35 ----------------------------------------------------------------------
    R.F = { arms: [] };
    for (const h of [14, 23, 3, 20.99]) {
      H.setTimeOfDay(h);
      eids = freshFight();
      R.F.arms.push({ hour: h, kill: killOne(eids[0]) });
    }
    H.setTimeOfDay(14);

    // ---- G. THE LOOP, DRIVEN AS A PLAYER -----------------------------------------------------
    // Earn enough to buy a level, stand at a well, rest, and drive the screen with real input.
    R.G = {};
    E.sim.progression.soulsHeld = 0;
    E.sim.progression.level = 1;
    E.sim.progression.soulsSpent = 0;
    let guard = 0;
    while (stats().souls < stats().souls_to_next && guard++ < 12) {
      const es = freshFight();
      for (const eid of es) { killOne(eid); if (stats().souls >= stats().souls_to_next) break; }
    }
    R.G.earned_souls = stats().souls;
    R.G.kills_to_first_level = guard;
    R.G.price_of_level_2 = stats().souls_to_next;

    // Stand at a sapwell and rest. `atHearth` is the gate the level-up screen reads.
    const wells = H.listHearths ? H.listHearths() : null;
    const list = (wells && wells.hearths) || (Array.isArray(wells) ? wells : []);
    R.G.hearths = list.length;
    // WALK TO A WELL. `setAtHearth(true)` only flips the UI gate; `hearthRest()` resolves the
    // nearest ACTUAL sapwell and refuses ("No sapwell within reach") from anywhere else, which
    // is what round 1 of this probe measured. The body is put at a real well so the rest is the
    // rest RI-PRG04 §1 describes rather than the pools-and-clamp half of it.
    const well = list[0];
    R.G.well = well ? well.id : null;
    if (well && well.pos) { try { H.teleport(well.pos[0], well.pos[2], {}); H.stepFrames(2); } catch (e) { R.G.teleport_error = String(e.message || e); } }
    try { H.setAtHearth(true); } catch (e) { R.G.set_at_hearth_error = String(e.message || e); }
    try { R.G.rest = H.hearthRest({}); } catch (e) { R.G.rest_error = String(e.message || e); }

    const read = () => {
      const s = stats();
      const b = E.combat && E.combat.player;
      return { level: s.level, souls: s.souls, souls_spent: s.souls_spent, gold: gold(),
        attributes: { ...s.attributes }, hp_max: s.hp_max, stamina_max: s.stamina_max,
        body_hp_max: b ? b.hpMax : null, body_stamina_max: b ? b.staminaMax : null };
    };
    R.G.before = read();
    try {
      H.openMenu('levelup');
      R.G.ui_mode = H.getUIState().mode;
      const rows = (H.getUIState().elements || []).filter((e) => e.kind === 'attribute_row');
      R.G.rows = rows.length;
      const cur = Math.max(0, rows.findIndex((e) => e.focused));
      const want = rows.findIndex((e) => e.meta && e.meta.attribute === 'vigour');
      R.G.target_row = want;
      const steps = want - cur, dir = steps >= 0 ? -1 : 1;
      for (let k = 0; k < Math.abs(steps); k++) {
        H.queueInputs([{ f: 0, move: [0, dir] }]); H.stepFrames(1);
        H.queueInputs([{ f: 0, move: [0, 0] }]); H.stepFrames(1);
      }
      const pv = (H.getUIState().elements || []).find((e) => e.kind === 'attribute_preview');
      R.G.the_screen_promised = pv && pv.meta ? pv.meta.derived : null;
      for (const k of ['press', 'release', 'press', 'release']) {
        H.queueInputs([{ f: 0, [k]: ['interact'] }]); H.stepFrames(1);
      }
      H.closeMenu();
      H.stepFrames(30);
    } catch (e) { R.G.spend_error = String(e.message || e); }
    R.G.after = read();

    // ---- G3. THE ENTITY CHANGES BEHAVIOUR ----------------------------------------------------
    // RI-MTH07 asks for a perturbation that an entity RESPONDS to, and a max-HP number moving is
    // only half of that. So the same scripted hit is landed on the body at the pre-spend pool and
    // at the post-spend pool: it must be survivable on exactly one side. `damagePlayer` routes
    // through the same `mitigate()` the weapon resolver uses, so this is the fight's own maths.
    R.G.behaviour = {};
    try {
      const hpMaxAfter = read().body_hp_max;
      const hpMaxBefore = R.G.before.body_hp_max;
      // A hit sized between the two ceilings: lethal against the old body, survivable by the new.
      const blow = Math.floor((hpMaxBefore + hpMaxAfter) / 2) + 1;
      R.G.behaviour.blow = blow;
      R.G.behaviour.hp_max_before_spend = hpMaxBefore;
      R.G.behaviour.hp_max_after_spend = hpMaxAfter;
      E.combat.player.hp = hpMaxAfter;
      H.damagePlayer(blow, { stagger: false });
      H.stepFrames(1);
      R.G.behaviour.survived_with_the_level = E.combat.player.hp > 0;
      R.G.behaviour.hp_left = Math.round(E.combat.player.hp);
      R.G.behaviour.would_have_died_without_it = blow >= hpMaxBefore;
      E.combat.player.hp = hpMaxAfter; E.combat.player.dead = false;
      H.stepFrames(1);
    } catch (e) { R.G.behaviour.error = String(e.message || e); }

    // ---- H. THE SPEND SURVIVES A SAVE — AUDITED ON THE LIVE WORLD ----------------------------
    R.H = { before_save: read() };
    try {
      await H.writeSave('souls-probe');
      R.H.wrote = true;
      // Contaminate the LIVE world so a load that does nothing is distinguishable from a load
      // that works. Without this a "restored" value could simply be the value never touched.
      E.sim.progression.soulsHeld = 7;
      E.sim.progression.level = 1;
      E.sim.progression.attributes.vigour = 3;
      R.H.contaminated = read();
      await H.readSave('souls-probe');
      H.stepFrames(2);
      R.H.after_load_live = read();
    } catch (e) { R.H.error = String(e.message || e); }

    // ---- I. NO DOUBLE PAY ACROSS A LOAD ------------------------------------------------------
    R.I = {};
    try {
      const es = freshFight();
      const k = killOne(es[0]);
      R.I.the_kill = k;
      await H.writeSave('souls-probe-2');
      const held = stats().souls;
      await H.readSave('souls-probe-2');
      H.stepFrames(10);
      R.I.souls_at_save = held;
      R.I.souls_after_load_and_10_frames = stats().souls;
    } catch (e) { R.I.error = String(e.message || e); }

    // ============================================================================================
    // K, L, M — THE THREE ARMS THAT DO NOT USE A HARNESS KILL VERB
    // ============================================================================================
    //
    // The W1-SOULS round-1 verdict's central charge: "every one of the twelve arms kills with
    // `H.killEntity()`, a harness verb that writes `b.hp = 0; b.dead = true; b.state = 'DEAD'`
    // directly. The suite proves the scan reads a dead body. It does not prove a fight pays."
    //
    // These three run LAST because each reloads the world.

    /**
     * A real fight, driven with latched `light` input and nothing else. Lifted from
     * `critic-souls-r1.mjs` K1 per the verdict's path-to-ten item 5, which says it can be lifted
     * wholesale. `attack: false` is the self-break control: the identical loop with the input
     * removed must kill nothing and pay nothing, or the arm is measuring the loop, not the swing.
     */
    const duel = ({ attack = true, cap = 5400, dist = 1.6 } = {}) => {
      H.loadState('arena_flat');
      H.setRenderRate(0);
      H.setCharacter({ race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' });
      H.setTimeOfDay(14);
      E.sim.progression.soulsHeld = 0;
      H.stepFrames(2);
      const sp = H.spawn('inf_trash', 0, dist);
      const eid = sp && sp.eid ? sp.eid : (typeof sp === 'string' ? sp : (H.listEntities()[0] || {}).eid);
      H.lockOn(eid);
      H.stepFrames(3);
      H.traceStart({ events: true });
      H.traceDrain();
      const soulsAt = stats().souls;
      let f = 0, died = null; const evs = []; let swings = 0;
      const period = 34;           // press, release, wait out the recovery, press again
      while (f < cap) {
        if (attack && f % period === 0) { H.queueInputs([{ f: 0, press: ['light'] }]); swings++; }
        if (attack && f % period === 2) H.queueInputs([{ f: 0, release: ['light'] }]);
        H.stepFrames(1); f++;
        for (const rec of H.traceDrain() || []) {
          for (const ev of rec.events || []) if (ev.type === 'souls_awarded') evs.push(ev);
        }
        const b = E.combat.bodyOf(String(eid));
        if (died === null && b && (b.hp <= 0 || b.dead)) died = f;
        if (died !== null && f > died + 4) break;
      }
      // Nothing in this loop touched hp, `dead`, `state` or `soulsHeld`. The only writes are
      // `press`/`release` on the `light` button.
      return { eid, frames_to_death: died, capped: died === null, swings,
        souls_before: soulsAt, souls_after: stats().souls, delta: stats().souls - soulsAt,
        events: evs.map((e) => ({ type: e.type, souls: e.souls, base: e.base, night: e.night, gold_awarded: e.gold_awarded })),
        seconds_at_60hz: died === null ? null : Math.round(died / 60 * 100) / 100 };
    };

    R.K = { declared_souls: E.data.enemies.inf_trash.souls };
    try {
      R.K.fight = duel({ attack: true });
      R.K.control_no_input = duel({ attack: false, cap: 1200 });
    } catch (e) { R.K.error = String(e.message || e); }

    // ---- L. THE HAZARD DEATH PATH, THROUGH THE REAL H9 LOOP -----------------------------------
    //
    // Verdict HF-2: a hazard kill paid nothing AND resurrected the corpse, because H9 wrote
    // `ent.hp` on the `sim.entities` MIRROR and `combat-bridge.js mirror()` restores it from the
    // untouched combat body every step.
    //
    // Both halves below call the SAME function — `HazardSystem.step()`, the real one, with the
    // real H9 branch — on the same hazard and the same body. The ONLY difference is the fourth
    // argument: with the CombatSystem, `_hurtEntity` damages the authority; without it, it falls
    // back to writing the view, which is byte-for-byte what the code did before this round. So
    // the control is the defect, live, rather than a description of it.
    //
    // `the-fall` is used rather than `voriplasm` because it carries no ANCHOR entry, so the
    // in-volume test is the region test and does not depend on a placed signature being within
    // 6 m in an arena. The enemy's hp is lowered so one 18%-of-max trap tick is lethal — the
    // defect under test is the WRITE TARGET, not the magnitude.
    const hazardRun = (withCombat) => {
      H.loadState('arena_flat');
      H.setRenderRate(0);
      H.setTimeOfDay(14);
      E.sim.progression.soulsHeld = 0;
      if (E.sim.souls) E.sim.souls.reset();
      H.stepFrames(2);
      const sp = H.spawn('inf_trash', 0, 2.0);
      const eid = sp && sp.eid ? sp.eid : (typeof sp === 'string' ? sp : (H.listEntities()[0] || {}).eid);
      H.stepFrames(2);                       // the scan must SEE it alive before it can pay for it
      const body = E.combat.bodyOf(String(eid));
      const ent = E.sim.entities.find((x) => x.eid === String(eid));
      if (!body || !ent) return { error: 'no body/entity' };
      body.hp = 40; ent.hp = 40;             // one trap tick is 18% of 412 = 74
      H.stepFrames(1);

      const HZ = E.hazards;
      if (!HZ) return { error: 'no hazard system' };
      const h = (HZ.doc.hazards || []).find((x) => x.id === 'the-fall');
      if (!h) return { error: 'hazard the-fall not on disk' };
      const ctx = HZ._context(E.sim);
      // ---- SCAFFOLDING, DECLARED. Three things stop a hazard firing in an arena, and none of
      // them is the branch under test:
      //   `_suppressed()` returns 'camera fixture' for any `sim.cellId`, which every arena has;
      //   `_inside()` is false because `the-fall` has neither a placed anchor nor a CONDITION
      //     predicate that a flat arena satisfies;
      //   `byRegion.get(ctx.region)` is empty because the arena is not one of the 13 regions.
      // All three are about WHERE THE PLAYER IS. H9 — "hazards hurt everyone" — and
      // `_hurtEntity` are untouched, and they are the whole subject of this arm. The first run
      // of this arm seeded `active` without overriding `_inside`, and the hazard-exit branch
      // deleted the entry before H9 ever read it: the arm reported no damage at all and went red
      // for the wrong reason.
      const savedByRegion = HZ.byRegion, savedInside = HZ._inside, savedSuppressed = HZ._suppressed;
      HZ.byRegion = new Map([[ctx.region, [h]]]);
      HZ._inside = () => true;
      HZ._suppressed = () => null;
      HZ.spent.delete(h.id); HZ.active.delete(h.id); HZ.told.delete(h.id);
      const soulsBefore = E.sim.progression.soulsHeld;
      H.traceStart({ events: true }); H.traceDrain();
      let stepError = null;
      let armed = null, hereCount = 0;
      try {
        // Pass 1 ARMS the volume through the system's own entry branch.
        HZ.step(E.sim, E.bus, E.combat.player, withCombat ? E.combat : null);
        hereCount = (HZ.byRegion.get(ctx.region) || []).length;
        armed = HZ.active.get(h.id) || null;
        // Skip the telegraph. `damageFrom = toldAt + lead_s x 60` is H1's business (4 s here);
        // this arm is about H9's write target, so the wait is elided rather than slept through.
        if (armed) armed.damageFrom = E.sim.frame;
        // Pass 2 DAMAGES, through the real H9 loop.
        HZ.step(E.sim, E.bus, E.combat.player, withCombat ? E.combat : null);
      } catch (err) { stepError = String(err.message || err); }
      HZ._inside = savedInside; HZ._suppressed = savedSuppressed;
      const bodyHpRightAfter = body.hp;
      const entHpRightAfter = ent.hp;
      H.stepFrames(4);                       // mirror() runs, then stepSouls sees the transition
      const evs = [];
      for (const rec of H.traceDrain() || []) {
        for (const ev of rec.events || []) if (ev.type === 'souls_awarded') evs.push({ souls: ev.souls, archetype: ev.archetype });
      }
      const after = E.sim.entities.find((x) => x.eid === String(eid));
      const bodyAfter = E.combat.bodyOf(String(eid));
      HZ.byRegion = savedByRegion;
      HZ.active.delete(h.id);
      return {
        with_combat: !!withCombat, hazard: h.id, step_error: stepError,
        region: ctx.region, hazards_visited: hereCount, armed: !!armed,
        declared_damage: h.damage, hp_before_tick: 40,
        body_hp_right_after: bodyHpRightAfter, entity_hp_right_after: entHpRightAfter,
        body_hp_4_frames_later: bodyAfter ? bodyAfter.hp : null,
        entity_hp_4_frames_later: after ? after.hp : null,
        body_dead: bodyAfter ? !!bodyAfter.dead : null,
        souls_before: soulsBefore, souls_after: E.sim.progression.soulsHeld,
        delta: E.sim.progression.soulsHeld - soulsBefore, events: evs,
      };
    };
    R.L = {};
    try { R.L.fixed = hazardRun(true); } catch (e) { R.L.fixed = { error: String(e.message || e) }; }
    try { R.L.control_view_write = hazardRun(false); } catch (e) { R.L.control_view_write = { error: String(e.message || e) }; }

    // ---- M. THE REST EPOCH, SCOPED TO THE ONE CASE IT STILL GOVERNS ---------------------------
    //
    // ROUND 3 CHANGED WHAT THIS ARM ASSERTS, and the change is the point of the round.
    //
    // Round 1 charged an unlimited farm: kill/despawn/respawn paid +816, +816, +816 with zero
    // rests, because `_alive` was keyed on the eid and `spawnEncounter` mints deterministic ones.
    // Round 2 answered it by refusing to re-arm a recycled eid without a rest — and the round-2
    // verdict then measured the other edge of that same refusal: five live, full-HP hostiles at a
    // road post the player had half cleared, worth **nothing** (HF-2). One key, two directions.
    //
    // So round 3 splits the question in two and this arm follows the half that is still souls':
    //
    //   * a body REVIVED IN PLACE — `death.js respawnOrdinary()` setting `e.hp = e.hpMax` on the
    //     entity that is still in the array — is the SAME body, and it re-arms only across the S5
    //     rest epoch. That is `RI-PRG06` §4's `Respawned enemy x1.00` row and it is asserted here.
    //   * a body the world REBUILT is a different body and pays. Whether the world was entitled to
    //     rebuild it is ARBITRATION S5 and belongs to whoever rebuilt it — asserted as invariant
    //     I3 by `tools/progression/souls-ledger-oracle.mjs`, over arbitrary routes, and kept by
    //     `world/population.js`'s register of who was down at a released post (arm O below).
    //
    // The old driver despawned and re-spawned between passes, which under round 3 is the second
    // case and not the first. It now revives in place, which is the case under test.
    R.M = { passes: [], rests: 0 };
    try {
      H.loadState('arena_flat');
      H.setRenderRate(0);
      H.setTimeOfDay(14);
      E.sim.progression.soulsHeld = 0;
      if (E.sim.souls) E.sim.souls.reset();
      H.stepFrames(2);
      const p = stats().pos;
      H.spawnEncounter('deep-kin-war-brood', p[0] + 4, p[2] + 4, { tag: 'probe-M' });
      H.stepFrames(2);
      const es = (H.listEntities() || []).map((e) => e.eid || e.id).filter((x) => x && !!E.combat.bodyOf(String(x)));
      R.M.eids = es;
      // Kill, then bring the SAME OBJECTS back with no rest, twice. `revive()` is what a
      // hypothetical free respawn would do to the entity that is still in the array — it is
      // deliberately NOT `respawnOrdinary()`, because that bumps the epoch, which is the thing
      // under test. The souls ledger must see the same body and refuse.
      const revive = () => {
        for (const eid of es) {
          const e = E.sim.findEntity(eid); const b = E.combat.bodyOf(String(eid));
          if (e) { e.hp = e.hpMax; e.state = 'IDLE'; }
          if (b) { b.hp = b.hpMax; b.dead = false; b.state = 'IDLE'; }
        }
        H.stepFrames(2);
      };
      const killPass = (label) => {
        const before = E.sim.progression.soulsHeld;
        for (const eid of es) { try { H.killEntity(eid); } catch { /* gone */ } }
        H.stepFrames(3);
        return { label, eids: es, bodies: es.length, paid: E.sim.progression.soulsHeld - before,
          refused_rearms: E.sim.souls ? E.sim.souls.refusedRearms : null,
          rebuilds: E.sim.souls ? E.sim.souls.rebuilds : null };
      };
      R.M.passes.push(killPass('first kill'));
      revive(); R.M.passes.push(killPass('revived IN PLACE with NO rest'));
      revive(); R.M.passes.push(killPass('revived IN PLACE with NO rest, again'));
      R.M.same_eids = true;
      R.M.same_objects = true;
      // Now REST — the S5 event — and the same bodies must become payable again at x1.00.
      const epochBefore = E.death ? E.death.ordinaryRespawnEpoch : null;
      E.death.respawnOrdinary(E.sim, E.combat, E.bus, 'probe_hearth_rest');
      R.M.rests = 1;
      R.M.epoch = { before: epochBefore, after: E.death ? E.death.ordinaryRespawnEpoch : null };
      H.stepFrames(2);
      R.M.passes.push(killPass('after ONE rest'));

    } catch (e) { R.M.error = String(e.message || e); }

    // ---- N. THE SCENARIO BOUNDARY. W1-SOULS-r2 HF-1, and the verdict's acceptance leg (a). ----
    //
    // "an untagged fight, killed, crossed over `loadState('<named>')`, killed again, must pay both
    // times." Round 2's suite made every fight carry a unique tag, which is a workaround at the
    // call site; this arm deliberately does NOT tag, because the tag was the thing hiding it.
    R.N = {};
    try {
      const fightUntagged = () => {
        const r = H.spawnEncounter('dres-raid-party', 0, 12);
        H.stepFrames(2);
        const before = E.sim.progression.soulsHeld;
        for (const eid of r.eids) { try { H.killEntity(eid); } catch { /* npc */ } }
        H.stepFrames(4);
        return { eids: r.eids, paid: E.sim.progression.soulsHeld - before,
          refused: E.sim.souls.refusedRearms, rebuilds: E.sim.souls.rebuilds };
      };
      H.loadState('arena_flat'); H.setRenderRate(0); H.setTimeOfDay(14);
      R.N.pass1 = fightUntagged();
      H.loadState('arena_flat');                        // the boundary every probe in this tree uses
      H.setTimeOfDay(14);
      R.N.entities_after_boundary = (H.listEntities() || []).length;
      R.N.pass2 = fightUntagged();
      R.N.same_eids = JSON.stringify(R.N.pass1.eids) === JSON.stringify(R.N.pass2.eids);
      R.N.hearth_rests = 0;
      R.N.observer_census = E.getSessionObserverCensus ? E.getSessionObserverCensus() : null;
    } catch (e) { R.N.error = String(e.message || e); }

    // ---- O. A PARTLY-CLEARED POST. W1-SOULS-r2 HF-2, and the verdict's acceptance leg (b). ----
    //
    // "a post with n bodies, n-1 killed, despawned wholesale and re-spawned under the SAME tag,
    // must pay for all n-1 of the recycled bodies on the second visit AND must still pay nothing
    // for a body that was never despawned and never rested past."
    //
    // Driven through `PopulationSystem`'s own release and `_materialise()` rather than through
    // bare harness verbs, because round 3 put the S5 guarantee in that file: a released post
    // remembers who was down and brings back only the survivors. So the arm asserts BOTH halves —
    // the reward pays for every body the world builds, and the world does not build the dead one.
    R.O = {};
    try {
      H.loadState('arena_flat'); H.setRenderRate(0); H.setTimeOfDay(14);
      E.sim.progression.soulsHeld = 0;
      const P = E.population;
      R.O.population_enabled = P ? P.enabled : null;   // W1-POPULATION-r1 §7: reset() misses it
      if (P) { P.enabled = true; P.reset(); }
      const POST = { id: 'probe-post-O', encounter: 'dres-raid-party', x: 0, z: 12, region: null, tier: 1 };
      P.byId.set(POST.id, POST);
      P._materialise(E, POST);
      H.stepFrames(2);
      const first = (P.live.get(POST.id) || []).slice();
      R.O.bodies_first_visit = first.length;
      const victims = first.slice(0, Math.max(1, first.length - 1));
      const survivor = first[first.length - 1];
      let before = E.sim.progression.soulsHeld;
      for (const eid of victims) { try { H.killEntity(eid); } catch { /* npc */ } }
      H.stepFrames(4);
      R.O.paid_first_visit = E.sim.progression.soulsHeld - before;
      R.O.killed_first_visit = victims.length;
      // RELEASE — step (3) of world/population.js, driven by walking past release_radius_m.
      // Called here directly with the player teleported out of range so the arm does not depend
      // on the province cell; the branch executed is the file's own.
      const rel = (P.d.release_radius_m || 260) + 50;
      E.sim.player.pos[0] = POST.x + rel; E.sim.player.pos[2] = POST.z + rel;
      P.step(E);
      // `step()` returns early outside the province cell, so step (3)'s body is invoked through
      // `PopulationSystem.releasePost()` — the SHIPPED method, not a copy of it. Declared, not
      // hidden: this is a MECHANISM test, not a walked route.
      R.O.released = P.releasePost(E, POST.id);
      H.stepFrames(1);
      R.O.entities_after_release = (H.listEntities() || []).filter((e) => String(e.eid || e.id).startsWith(POST.id)).length;
      R.O.remembered_down = [...(P.down.get(POST.id) || [])];
      // RE-MATERIALISE — step (4), same stable tag, which is what recycles the eids.
      P._materialise(E, POST);
      H.stepFrames(2);
      const second = (P.live.get(POST.id) || []).slice();
      R.O.bodies_second_visit = second.length;
      R.O.same_eids = second.every((e) => first.includes(e));
      R.O.survivor_back = second.includes(survivor);
      R.O.dead_left_down = victims.every((e) => !second.includes(e));
      before = E.sim.progression.soulsHeld;
      for (const eid of second) { try { H.killEntity(eid); } catch { /* npc */ } }
      H.stepFrames(4);
      R.O.paid_second_visit = E.sim.progression.soulsHeld - before;
      R.O.rests = 0;
      R.O.epoch = E.death ? E.death.ordinaryRespawnEpoch : null;
      // AND NOW A REST — S5 — which must bring the whole post back and pay for all of it.
      E.death.respawnOrdinary(E.sim, E.combat, E.bus, 'probe_rest');
      P.step(E);
      P.down.clear();                                  // step (0) does this on the epoch bump
      P.releasePost(E, POST.id);
      P._materialise(E, POST);
      H.stepFrames(2);
      const third = (P.live.get(POST.id) || []).slice();
      R.O.bodies_after_rest = third.length;
      before = E.sim.progression.soulsHeld;
      for (const eid of third) { try { H.killEntity(eid); } catch { /* npc */ } }
      H.stepFrames(4);
      R.O.paid_after_rest = E.sim.progression.soulsHeld - before;
    } catch (e) { R.M.error = String(e.message || e); }

    return R;
  });

  out.arms = probe;

  // ---- verdicts ------------------------------------------------------------------------------
  const v = [];
  const ok = (name, cond, detail) => { v.push({ name, pass: !!cond, detail: String(detail) }); return !!cond; };
  const A = probe.A, B = probe.B, C = probe.C, D = probe.D, E = probe.E, F = probe.F, G = probe.G, H = probe.H, I = probe.I;

  const aReal = (A.kills || []).filter((k) => !k.skipped);
  const aPaid = aReal.filter((k) => k.delta === A.declared_souls).length;
  ok('A  the source exists: every kill pays exactly the statblock value',
    aReal.length > 0 && aPaid === aReal.length && A.souls_at_end > A.souls_at_start,
    `${aPaid}/${aReal.length} kills paid ${A.declared_souls} (${A.kills.length - aReal.length} skipped, no body); `
    + `souls ${A.souls_at_start} -> ${A.souls_at_end}, next level costs ${A.souls_to_next}`);

  // DE-VACUUMED (verdict F-4). `bMoved === 0 && B.kills.length > 0` counted SKIPPED kills — a
  // skip has `delta === 0` and is still in `length`, so three skips passed the ablation arm
  // without a body ever dying. Only unskipped kills count now, and there must be some.
  const bReal = (B.kills || []).filter((k) => !k.skipped);
  const bMoved = bReal.filter((k) => k.delta !== 0).length;
  ok('B  ABLATION: with sim/souls.js switched off the counter is DEAD (if this passes while A passes, A is real)',
    bReal.length > 0 && bMoved === 0,
    `${bMoved}/${bReal.length} REAL kills moved souls with the module ablated (must be 0 of at least 1); `
    + `${B.kills.length - bReal.length} skipped and not counted`);

  const c0 = C.arms.find((a) => a.set_to === 0), c9 = C.arms.find((a) => a.set_to === 999);
  ok('C  DELETE-THE-FIX on the number: the shipped `souls` field IS what the world pays',
    c0 && c0.kill.delta === 0 && c9 && c9.kill.delta === 999 && C.restored.kill.delta === C.shipped,
    `souls=0 -> +${c0 && c0.kill.delta}; souls=999 -> +${c9 && c9.kill.delta}; restored ${C.shipped} -> +${C.restored.kill.delta}`);

  // DE-VACUUMED (verdict F-4). `!D.kill` was the ERROR path: if `H.spawn('dummy_passive', …)`
  // threw, the arm passed with no dummy ever spawned — the verdict forced the throw with a
  // duplicate eid and watched the predicate return true. The kill must now EXIST and must not be
  // a skip, so the arm can only pass by having actually killed a dummy and been paid nothing.
  ok('D  a 99,999-hp training dummy is not an infinite soul farm',
    D.declared_souls === 0 && !!D.kill && !D.kill.skipped && D.kill.delta === 0,
    `dummy_passive declares ${D.declared_souls} souls at ${D.hp} hp; `
    + (D.kill ? `the kill${D.kill.skipped ? ' WAS SKIPPED (' + D.kill.skipped + ')' : ''} paid ${D.kill.delta}`
      : `NO KILL HAPPENED — ${D.error} (this used to pass)`));

  const e1 = E.arms.find((a) => a.player_level === 1), e90 = E.arms.find((a) => a.player_level === 90);
  ok('E  S9: the same kill pays the same souls at level 1 and at level 90 — no scaling of any kind',
    e1 && e90 && e1.kill.delta === e90.kill.delta && e1.kill.delta > 0,
    `level 1 -> +${e1 && e1.kill.delta}; level 90 -> +${e90 && e90.kill.delta}`);

  const day = F.arms.find((a) => a.hour === 14), night = F.arms.find((a) => a.hour === 23);
  const small = F.arms.find((a) => a.hour === 3), edge = F.arms.find((a) => a.hour === 20.99);
  const base = day ? day.kill.delta : 0;
  ok('F  RI-PRG06 §4 night multiplier: x1.35 inside 21:00-05:00 and x1.00 outside it',
    day && night && small && edge && base > 0
      && night.kill.delta === Math.round(base * 1.35) && small.kill.delta === Math.round(base * 1.35)
      && edge.kill.delta === base,
    `14:00 -> ${base}; 23:00 -> ${night && night.kill.delta}; 03:00 -> ${small && small.kill.delta}; 20:59 -> ${edge && edge.kill.delta} (expected ${base}/${Math.round(base * 1.35)}/${Math.round(base * 1.35)}/${base})`);

  const gAttrMoved = G.after && G.before ? (G.after.attributes.vigour - G.before.attributes.vigour) : 0;
  const gPoolMoved = G.after && G.before ? (G.after.body_hp_max - G.before.body_hp_max) : 0;
  ok('G1 the loop closes: souls earned by fighting buy a level at a sapwell, driven with real input',
    G.after && G.before && G.after.level === G.before.level + 1 && gAttrMoved === 1
      && G.before.souls - G.after.souls === G.price_of_level_2,
    `level ${G.before && G.before.level} -> ${G.after && G.after.level}, vigour +${gAttrMoved}, `
    + `souls ${G.before && G.before.souls} -> ${G.after && G.after.souls} (price ${G.price_of_level_2}); earned in ${G.kills_to_first_level} encounter(s)`);
  ok('G2 CONSUMPTION: the bought attribute reaches the BODY — the combat body\'s max HP moves',
    gPoolMoved > 0,
    `combat body hp_max ${G.before && G.before.body_hp_max} -> ${G.after && G.after.body_hp_max} (delta ${gPoolMoved}); the screen promised ${JSON.stringify(G.the_screen_promised)}`);

  const bh = G.behaviour || {};
  ok('G3 CONSUMPTION: the body BEHAVES differently — a blow that the pre-spend body could not survive is survived',
    bh.hp_max_after_spend > bh.hp_max_before_spend && bh.would_have_died_without_it === true && bh.survived_with_the_level === true,
    `hp_max ${bh.hp_max_before_spend} -> ${bh.hp_max_after_spend}; a ${bh.blow}-point blow leaves ${bh.hp_left} hp `
    + `(lethal at the old ceiling: ${bh.would_have_died_without_it})${bh.error ? ' — ' + bh.error : ''}`);

  const hOk = H.after_load_live && H.before_save;
  ok('H  the spend survives a save and a load, AUDITED ON THE LIVE WORLD (not the blob)',
    hOk && H.after_load_live.level === H.before_save.level
      && H.after_load_live.souls === H.before_save.souls
      && H.after_load_live.attributes.vigour === H.before_save.attributes.vigour
      && H.contaminated && H.contaminated.souls === 7,
    hOk ? `saved L${H.before_save.level}/${H.before_save.souls} souls/vigour ${H.before_save.attributes.vigour}; `
      + `contaminated to L${H.contaminated.level}/${H.contaminated.souls}/vigour ${H.contaminated.attributes.vigour}; `
      + `live world after load L${H.after_load_live.level}/${H.after_load_live.souls}/vigour ${H.after_load_live.attributes.vigour}`
      : `error: ${H.error}`);

  // DE-VACUUMED (verdict F-4). Nothing required a kill to have happened: `killOne()` returns
  // `{skipped, delta: 0}` when there is no body, so the arm passed on 0 -> 0 with no corpse and
  // no payment. The builder's own -DELETED run is the proof — arm I was green there. The kill
  // must now have really happened and really paid before "it did not pay twice" means anything.
  ok('I  a corpse restored by a load does not pay a second time',
    !!I.the_kill && !I.the_kill.skipped && I.the_kill.delta > 0
      && I.souls_at_save !== undefined && I.souls_after_load_and_10_frames === I.souls_at_save,
    `the corpse cost ${I.the_kill ? I.the_kill.delta : 'NO KILL'} souls to make; `
    + `souls at save ${I.souls_at_save} -> after load + 10 frames ${I.souls_after_load_and_10_frames}`);

  const allKills = [].concat(A.kills || [], (C.arms || []).map((a) => a.kill), (F.arms || []).map((a) => a.kill));
  const goldMoved = allKills.filter((k) => k && k.gold_after !== k.gold_before).length;
  const evs = allKills.flatMap((k) => (k && k.events) || []);
  ok('J  S15: no kill anywhere in this run moved gold, and every award declares gold_awarded 0',
    goldMoved === 0 && evs.length > 0 && evs.every((e) => e.gold_awarded === 0),
    `${goldMoved}/${allKills.length} kills moved gold; ${evs.length} souls_awarded events, all gold_awarded 0`);

  // ---- K, L, M — no harness kill verb anywhere in any of the three ---------------------------
  const K = probe.K || {}, L = probe.L || {}, M = probe.M || {};
  const kf = K.fight || {}, kc = K.control_no_input || {};
  ok('K  A FIGHT PAYS: latched `light` input kills a live inf_trash and souls move — no kill verb',
    kf.frames_to_death !== null && kf.delta === K.declared_souls && (kf.events || []).length === 1
      && kc.frames_to_death === null && kc.delta === 0,
    `${kf.swings} swings, the sentry dies on frame ${kf.frames_to_death} (${kf.seconds_at_60hz} s @60), `
    + `souls ${kf.souls_before} -> ${kf.souls_after} (declared ${K.declared_souls}), `
    + `${(kf.events || []).length} souls_awarded event. SELF-BREAK, same loop with the input removed: `
    + `died ${kc.frames_to_death === null ? 'never' : 'at ' + kc.frames_to_death} in ${kc.swings} swings, paid ${kc.delta}`);

  const lf = L.fixed || {}, lc = L.control_view_write || {};
  ok('L  THE HAZARD DEATH PATH PAYS, and the control shows why it did not: the write must reach the body',
    lf.body_dead === true && lf.delta === (probe.K || {}).declared_souls && (lf.events || []).length >= 1
      && lc.delta === 0 && lc.entity_hp_4_frames_later > 0,
    `hazard ${lf.hazard} armed=${lf.armed} in region '${lf.region}'. `
    + `FIXED (HazardSystem.step with the CombatSystem): body hp ${lf.hp_before_tick} -> ${lf.body_hp_right_after} right after the tick, `
    + `dead ${lf.body_dead}, souls +${lf.delta}, ${(lf.events || []).length} event(s). `
    + `CONTROL (the same step, same hazard, same body, without it — i.e. the pre-fix write to the mirror): `
    + `entity hp ${lc.entity_hp_right_after} right after -> ${lc.entity_hp_4_frames_later} four frames later `
    + `(the corpse resurrects), souls +${lc.delta}`);

  const mp = M.passes || [];
  const mNoRest = mp.slice(1, 3);
  ok('M  the SAME BODY revived in place re-arms only across the S5 rest epoch',
    mp.length === 4 && mp[0].paid > 0
      && mNoRest.every((p) => p.paid === 0) && mp[3].paid === mp[0].paid,
    `first kill +${mp[0] && mp[0].paid}; the same entity objects revived in place; `
    + `two revivals with NO rest paid +${mNoRest.map((p) => p.paid).join(', +')} `
    + `(round 1 paid the full value on every one); after one rest (epoch ${M.epoch && M.epoch.before} -> ${M.epoch && M.epoch.after}) `
    + `+${mp[3] && mp[3].paid}; refused re-arms ${mp[2] && mp[2].refused_rearms}, `
    + `rebuilds seen ${mp[2] && mp[2].rebuilds} (must be 0 — nothing here was rebuilt)`);

  // ---- N and O: the W1-SOULS round-2 verdict's two named acceptance legs ---------------------
  const N = probe.N || {}, O = probe.O || {};
  ok('N  ACCEPTANCE (a): an UNTAGGED fight pays on both sides of loadState(\'<named>\')',
    !N.error && N.pass1 && N.pass2 && N.pass1.paid > 0 && N.pass2.paid === N.pass1.paid && N.same_eids === true,
    N.error ? `arm threw: ${N.error}`
      : `pass1 +${N.pass1.paid}, boundary (entities after: ${N.entities_after_boundary}), pass2 +${N.pass2.paid}; `
      + `the SAME eids came back (${N.same_eids}) and were paid anyway, with ${N.hearth_rests} rests and `
      + `${N.pass2.refused} refused re-arms. Round 2 measured +384 then +0 here.`);

  ok('O  ACCEPTANCE (b): a partly-cleared post pays for every body the world rebuilds, and the world leaves the dead down',
    !O.error && O.bodies_first_visit > 1
      && O.paid_first_visit > 0
      && O.dead_left_down === true && O.survivor_back === true
      && O.bodies_second_visit === O.bodies_first_visit - O.killed_first_visit
      && O.paid_second_visit > 0
      && O.bodies_after_rest === O.bodies_first_visit && O.paid_after_rest > 0,
    O.error ? `arm threw: ${O.error}`
      : `first visit ${O.bodies_first_visit} bodies, killed ${O.killed_first_visit}, +${O.paid_first_visit}; `
      + `released (${O.entities_after_release} left, ${O.remembered_down && O.remembered_down.length} remembered down); `
      + `re-materialised under the SAME tag -> ${O.bodies_second_visit} bodies, the dead stayed down `
      + `(${O.dead_left_down}), the survivor came back (${O.survivor_back}), killing them paid `
      + `+${O.paid_second_visit} with ${O.rests} rests; after ONE rest the post is whole again `
      + `(${O.bodies_after_rest} bodies) and pays +${O.paid_after_rest}. Round 2 measured five live `
      + 'full-HP hostiles worth +0 here.');

  out.verdicts = v;
  for (const r of v) say(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.detail}`);
  const bad = v.filter((r) => !r.pass).length;

  // ---- THE PICTURE ---------------------------------------------------------------------------
  // Taken in the browser this run already has open, per AGENT-PROTOCOL "Do not launch a browser
  // for a photograph" — the exception it names is exactly this ("you already have the world
  // open"). Rendering is off for the whole stepping run and is turned back on only for these
  // frames, which is the other half of the same rule.
  const shot = arg('shot', null);
  if (shot) {
    try {
      await page.setViewportSize({ width: 1280, height: 720 });
      const tableau = await page.evaluate(async () => {
        const H = window.__HARNESS, E = window.__ENGINE;
        // A clean tableau, and every soul in it EARNED: reset the purse, put a real encounter in
        // front of the player, kill it, then open the screen the souls are spent at.
        E.sim.progression.soulsHeld = 0; E.sim.progression.level = 1; E.sim.progression.soulsSpent = 0;
        H.setTimeOfDay(14);
        for (const e of H.listEntities() || []) { try { H.despawn(e.eid || e.id); } catch { /* gone */ } }
        const p = H.getPlayerStats().pos;
        H.spawnEncounter('dres-raid-party', p[0], p[2]);
        H.stepFrames(1);
        const eids = (H.listEntities() || []).map((e) => e.eid || e.id).filter((x) => x && !!E.combat.bodyOf(String(x)));
        for (const eid of eids) { H.killEntity(eid); H.stepFrames(2); }
        H.setAtHearth(true);
        H.openMenu('levelup');
        H.setRenderRate(60);
        H.stepFrames(4);
        const st = H.getPlayerStats();
        return { kills: eids.length, souls: st.souls, price: st.souls_to_next, level: st.level, mode: H.getUIState().mode };
      });
      await page.waitForTimeout(600);
      fs.mkdirSync(path.dirname(path.join(ROOT, shot)), { recursive: true });
      await page.screenshot({ path: path.join(ROOT, shot) });
      out.shot = { path: shot, tableau };
      say(`shot: ${shot} — ${tableau.kills} kills earned ${tableau.souls} souls, next level ${tableau.price}, screen '${tableau.mode}'`);
    } catch (e) { say(`shot failed: ${e.message || e}`); out.shot_error = String(e.message || e); }
  }

  // The falsifiability gate. A passes only if B goes red; C's two arms must disagree with each
  // other; F's day arm must differ from its night arm. A suite where every arm passes because
  // nothing is coupled to anything is exactly the failure this file exists to refuse.
  const unfalsifiable = [];
  if (v[0].pass && !v[1].pass) unfalsifiable.push('A passed but the ablation (B) did not go red — the counter is not reading sim/souls.js');
  if (C.arms && C.arms[0] && C.arms[1] && C.arms[0].kill.delta === C.arms[1].kill.delta) unfalsifiable.push('C: souls=0 and souls=999 paid the same — the data file is not the source of the number');
  if (day && night && day.kill.delta === night.kill.delta) unfalsifiable.push('F: the night arm is indistinguishable from the day arm');
  // K, L and M each carry their own control, and a control that behaved like its treatment makes
  // the arm meaningless whether or not the arm passed.
  if (kf.frames_to_death !== null && kc.frames_to_death !== null) unfalsifiable.push('K: the no-input control killed the enemy too — the arm is measuring the loop, not the swing');
  if (lf.delta === lc.delta) unfalsifiable.push('L: the hazard arm and its view-write control paid the same — the fourth argument changes nothing');
  if (mp.length === 4 && mp[0].paid === 0) unfalsifiable.push('M: the FIRST kill paid nothing, so "the re-spawns paid nothing" is not evidence of a gate');
  if (mp.length === 4 && M.same_eids !== true) unfalsifiable.push('M: the eids were not reused, so nothing tested the re-arm at all');
  out.unfalsifiable = unfalsifiable;
  for (const u of unfalsifiable) say(`UNFALSIFIABLE  ${u}`);

  say(`\nsouls-consumption: ${v.length - bad}/${v.length} arms pass, ${unfalsifiable.length} unfalsifiable`);
  const dest = arg('out', 'reports/souls-consumption.json');
  fs.mkdirSync(path.dirname(path.join(ROOT, dest)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, dest), JSON.stringify(out, null, 2));
  say(`wrote ${dest}`);
  await handle.close();
  process.exit(bad === 0 && unfalsifiable.length === 0 ? 0 : 1);
} catch (e) {
  say(`souls-consumption: the instrument could not run — ${e.stack || e.message || e}`);
  out.instrument_error = String(e.message || e);
  try { fs.writeFileSync(path.join(ROOT, arg('out', 'reports/souls-consumption.json')), JSON.stringify(out, null, 2)); } catch { /* nothing to write to */ }
  try { await handle.close(); } catch { /* already gone */ }
  process.exit(2);
}
