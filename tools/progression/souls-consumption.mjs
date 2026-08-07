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

    /** A fresh encounter in front of the player, and the eids it produced. */
    const freshFight = () => {
      for (const e of H.listEntities() || []) { try { H.despawn(e.eid || e.id); } catch { /* gone */ } }
      const p = stats().pos;
      H.spawnEncounter('dres-raid-party', p[0], p[2]);
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

  const bMoved = (B.kills || []).filter((k) => k.delta !== 0).length;
  ok('B  ABLATION: with sim/souls.js switched off the counter is DEAD (if this passes while A passes, A is real)',
    B.kills.length > 0 && bMoved === 0,
    `${bMoved}/${B.kills.length} kills moved souls with the module ablated (must be 0)`);

  const c0 = C.arms.find((a) => a.set_to === 0), c9 = C.arms.find((a) => a.set_to === 999);
  ok('C  DELETE-THE-FIX on the number: the shipped `souls` field IS what the world pays',
    c0 && c0.kill.delta === 0 && c9 && c9.kill.delta === 999 && C.restored.kill.delta === C.shipped,
    `souls=0 -> +${c0 && c0.kill.delta}; souls=999 -> +${c9 && c9.kill.delta}; restored ${C.shipped} -> +${C.restored.kill.delta}`);

  ok('D  a 99,999-hp training dummy is not an infinite soul farm',
    D.declared_souls === 0 && (!D.kill || D.kill.delta === 0),
    `dummy_passive declares ${D.declared_souls} souls at ${D.hp} hp; the kill paid ${D.kill ? D.kill.delta : 'n/a — ' + D.error}`);

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

  ok('I  a corpse restored by a load does not pay a second time',
    I.souls_at_save !== undefined && I.souls_after_load_and_10_frames === I.souls_at_save,
    `souls at save ${I.souls_at_save} -> after load + 10 frames ${I.souls_after_load_and_10_frames}`);

  const allKills = [].concat(A.kills || [], (C.arms || []).map((a) => a.kill), (F.arms || []).map((a) => a.kill));
  const goldMoved = allKills.filter((k) => k && k.gold_after !== k.gold_before).length;
  const evs = allKills.flatMap((k) => (k && k.events) || []);
  ok('J  S15: no kill anywhere in this run moved gold, and every award declares gold_awarded 0',
    goldMoved === 0 && evs.length > 0 && evs.every((e) => e.gold_awarded === 0),
    `${goldMoved}/${allKills.length} kills moved gold; ${evs.length} souls_awarded events, all gold_awarded 0`);

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
