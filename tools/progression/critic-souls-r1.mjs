#!/usr/bin/env node
// critic-souls-r1.mjs — the W1-SOULS round-1 critic's OWN instrument. Written mid-critique and
// declared under `method_deviations` in corpus/90-verdicts/wave1/W1-SOULS-r1.md.
//
// It exists because `tools/progression/souls-consumption.mjs` — the builder's 12-arm suite —
// kills every single body in every single arm with `H.killEntity()`, a harness verb that writes
// `b.hp = 0; b.dead = true; b.state = 'DEAD'` directly. Nothing in that suite ever lands a hit.
// So the suite proves the scan reads a dead body; it does not prove a FIGHT pays.
//
//   K1  A REAL WEAPON KILL PAYS.        Latched `light` input, a live inf_trash, no harness kill
//                                       verb anywhere. Souls must rise by the statblock value and
//                                       a `souls_awarded` event must be in the trace.
//   K2  MEASURED TIME-TO-KILL.          The same fight, in fixed frames, which is the number the
//                                       pace table asserts and never measured. Contention-proof:
//                                       frames at 60 Hz, not wall clock.
//   K3  THE HAZARD DEATH PATH.          `sim/hazards.js` kills by writing `ent.hp` on a
//                                       sim.entities record. Do exactly that and step.
//   K4  THE PLAYER IS AN ENTITY?        Does the player's own death enter the scan.
//   K5  RE-KILL WITHOUT A REST.         `spawnEncounter` mints DETERMINISTIC eids
//                                       (`<id>-<role>-<i>`). Kill, despawn, respawn, kill again.
//   K6  ARM-D VACUITY.                  Replay souls-consumption's arm-D predicate with the
//                                       dummy spawn throwing. `(!D.kill || delta === 0)` short-
//                                       circuits, so the arm passes when nothing was measured.
//   K7  ARM-I / ARM-B VACUITY.          Replay their predicates with zero real kills.
//   K8  INSTRUMENT SELF-BREAK.          Run K1's loop with the attack input REMOVED. If the
//                                       counter still reports a kill, K1/K2 measure nothing.
//
// Run: node tools/progression/critic-souls-r1.mjs [--out reports/critic-souls-r1.json]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const out = { tool: 'critic-souls-r1', at: new Date().toISOString(), arms: {}, verdicts: [] };
const say = (s) => console.log(s);

const handle = await launchGame({ width: 320, height: 240 });
const page = handle.page;
page.on('pageerror', (e) => say(`  [pageerror] ${e.message}`));
try {
  await page.waitForFunction(() => !!window.__HARNESS && !!window.__ENGINE, null, { timeout: 90000 });
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));

  const R = await page.evaluate(async () => {
    const H = window.__HARNESS, E = window.__ENGINE;
    const Z = {};
    H.setSeed(1337);
    H.setCharacter({ race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' });
    H.stepFrames(2);
    const stats = () => H.getPlayerStats();

    /**
     * A real fight, driven with latched input only. Returns the frame the body died on.
     * `attack` false is the self-break control: the same loop with nothing pressed.
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
      const hp0 = (H.listEntities().find((x) => x.eid === eid) || {}).hp;
      let f = 0, died = null, evs = [], swings = 0, playerDeadAt = null;
      const period = 34;           // press, release, wait out the recovery, press again
      while (f < cap) {
        if (attack && f % period === 0) { H.queueInputs([{ f: 0, press: ['light'] }]); swings++; }
        if (attack && f % period === 2) H.queueInputs([{ f: 0, release: ['light'] }]);
        H.stepFrames(1); f++;
        for (const rec of H.traceDrain() || []) {
          for (const ev of rec.events || []) if (ev.type === 'souls_awarded') evs.push(ev);
        }
        const b = E.combat.bodyOf(String(eid));
        if (playerDeadAt === null && E.combat.player && E.combat.player.hp <= 0) playerDeadAt = f;
        if (died === null && b && (b.hp <= 0 || b.dead)) died = f;
        if (died !== null && f > died + 4) break;
      }
      return { eid, hp0, frames_to_death: died, capped: died === null, swings,
        souls_before: soulsAt, souls_after: stats().souls, delta: stats().souls - soulsAt,
        events: evs, player_died_at: playerDeadAt,
        seconds_at_60hz: died === null ? null : +(died / 60).toFixed(2) };
    };

    // ---- K1 / K2 ------------------------------------------------------------------------------
    Z.K1 = duel({ attack: true });
    Z.K1.declared_souls = E.data.enemies.inf_trash.souls;

    // ---- K8 the self-break: the same loop, no attack ------------------------------------------
    Z.K8 = duel({ attack: false, cap: 1200 });

    // ---- K3 the hazard death path -------------------------------------------------------------
    // `sim/hazards.js` H9 does exactly `ent.hp = Math.max(0, ent.hp - d)` on a sim.entities
    // record, from Engine._settleWorld(), which stepOnce() calls AFTER stepSouls.
    Z.K3 = {};
    try {
      H.loadState('arena_flat'); H.setRenderRate(0); H.stepFrames(2);
      E.sim.progression.soulsHeld = 0;
      const sp = H.spawn('inf_trash', 0, 3.0);
      const eid = sp && sp.eid ? sp.eid : sp;
      H.stepFrames(2);                       // seen alive
      const before = stats().souls;
      const ent = E.sim.entities.find((e) => e.eid === eid);
      Z.K3.entity_hp_before = ent.hp;
      ent.hp = 0;                            // <- verbatim what a KILL-class hazard does
      Z.K3.entity_hp_after_write = ent.hp;
      H.stepFrames(1);
      Z.K3.souls_after_1_frame = stats().souls - before;
      Z.K3.entity_hp_after_1_frame = (E.sim.entities.find((e) => e.eid === eid) || {}).hp;
      H.stepFrames(30);
      Z.K3.souls_after_31_frames = stats().souls - before;
      Z.K3.entity_hp_after_31_frames = (E.sim.entities.find((e) => e.eid === eid) || {}).hp;
      Z.K3.body_hp = E.combat.bodyOf(String(eid)) ? E.combat.bodyOf(String(eid)).hp : null;
    } catch (e) { Z.K3.error = String(e.message || e); }

    // ---- K4 is the player inside the scan? ----------------------------------------------------
    Z.K4 = {};
    try {
      Z.K4.entity_ids = E.sim.entities.map((e) => e.eid);
      Z.K4.player_in_entities = E.sim.entities.some((e) => e.archetype === 'player' || e.eid === 'player');
    } catch (e) { Z.K4.error = String(e.message || e); }

    // ---- K5 kill, despawn, respawn, kill again — no hearth rest anywhere ----------------------
    Z.K5 = {};
    try {
      H.loadState('arena_flat'); H.setRenderRate(0); H.stepFrames(2);
      E.sim.progression.soulsHeld = 0;
      const p = stats().pos;
      const pay = () => {
        H.spawnEncounter('dres-raid-party', p[0], p[2]);
        H.stepFrames(1);
        const ids = (H.listEntities() || []).map((e) => e.eid).filter((x) => !!E.combat.bodyOf(String(x)));
        const b0 = stats().souls;
        for (const id of ids) H.killEntity(id);
        H.stepFrames(2);
        const got = stats().souls - b0;
        for (const id of ids) { try { H.despawn(id); } catch { /* gone */ } }
        H.stepFrames(1);
        return { eids: ids, paid: got };
      };
      Z.K5.pass1 = pay();
      Z.K5.pass2 = pay();
      Z.K5.pass3 = pay();
      Z.K5.same_eids = JSON.stringify(Z.K5.pass1.eids) === JSON.stringify(Z.K5.pass2.eids);
      Z.K5.hearth_rests = 0;
      Z.K5.total = stats().souls;
    } catch (e) { Z.K5.error = String(e.message || e); }

    // ---- K6 arm-D vacuity: the same predicate with the spawn throwing -------------------------
    Z.K6 = {};
    try {
      const D = { declared_souls: E.data.enemies.dummy_passive.souls, hp: E.data.enemies.dummy_passive.hp };
      // Make the spawn throw the way a real failure would, without touching any source file:
      // `Engine.spawn` refuses an eid that is already in use. `D.kill` is left UNSET, exactly
      // as souls-consumption.mjs leaves it when its own `H.spawn` throws.
      H.spawn('inf_trash', 0, 6, { as: 'critic-marker' });
      H.stepFrames(1);
      try {
        const d = H.spawn('dummy_passive', 0, 4, { as: 'critic-marker' });
        D.kill = { delta: 0, eid: d };
      } catch (err) { D.error = String(err.message || err); }
      // souls-consumption.mjs line 333-335, verbatim:
      Z.K6.arm_d_would_pass = D.declared_souls === 0 && (!D.kill || D.kill.delta === 0);
      Z.K6.D = D;
    } catch (e) { Z.K6.error = String(e.message || e); }

    // ---- K7 arm-I and arm-B vacuity: the same predicates with no real kill --------------------
    Z.K7 = {};
    try {
      const held = stats().souls;
      // arm I: `I.souls_at_save !== undefined && I.souls_after_load_and_10_frames === I.souls_at_save`
      const I = { the_kill: { skipped: 'no body at kill time', delta: 0 },
        souls_at_save: held, souls_after_load_and_10_frames: held };
      Z.K7.arm_i_would_pass = I.souls_at_save !== undefined && I.souls_after_load_and_10_frames === I.souls_at_save;
      Z.K7.arm_i_kills_that_happened = 0;
      // arm B: `B.kills.length > 0 && bMoved === 0` — a SKIPPED kill has delta 0 and is counted.
      const B = { kills: [{ skipped: 'no body at kill time', delta: 0 }, { skipped: 'no body at kill time', delta: 0 }] };
      Z.K7.arm_b_would_pass = B.kills.length > 0 && B.kills.filter((k) => k.delta !== 0).length === 0;
      Z.K7.arm_b_real_kills = B.kills.filter((k) => !k.skipped).length;
    } catch (e) { Z.K7.error = String(e.message || e); }

    return Z;
  });

  out.arms = R;
  const v = [];
  const ok = (n, c, d) => { v.push({ name: n, pass: !!c, detail: String(d) }); };

  const K1 = R.K1, K8 = R.K8;
  ok('K1 a REAL WEAPON KILL pays — no harness kill verb anywhere in this arm',
    K1.frames_to_death !== null && K1.delta === K1.declared_souls && K1.events.length === 1,
    `${K1.swings} latched light swings; body died on frame ${K1.frames_to_death}; souls ${K1.souls_before} -> ${K1.souls_after} `
    + `(declared ${K1.declared_souls}); ${K1.events.length} souls_awarded event(s)`);
  ok('K2 MEASURED time-to-kill, in fixed frames',
    K1.frames_to_death !== null,
    K1.frames_to_death === null ? `no kill inside ${5400} frames` :
      `${K1.frames_to_death} f@60 = ${K1.seconds_at_60hz} s of fighting for ${K1.declared_souls} souls`
      + (K1.player_died_at ? `; the PLAYER died on frame ${K1.player_died_at}` : '; the player survived'));
  ok('K8 SELF-BREAK: the same loop with the attack input removed must NOT report a kill',
    K8.frames_to_death === null && K8.delta === 0,
    `no-attack control: frames_to_death=${K8.frames_to_death}, souls delta ${K8.delta}, swings ${K8.swings}`);

  const K3 = R.K3;
  ok('K3 the HAZARD death path pays — `ent.hp = 0` on a sim.entities record, as sim/hazards.js does',
    K3.souls_after_31_frames > 0,
    `wrote hp ${K3.entity_hp_before} -> 0; after 1 frame hp=${K3.entity_hp_after_1_frame} souls+${K3.souls_after_1_frame}; `
    + `after 31 frames hp=${K3.entity_hp_after_31_frames} souls+${K3.souls_after_31_frames}; combat body hp=${K3.body_hp}`);

  const K5 = R.K5;
  ok('K5 S5: an ordinary enemy pays again only after a HEARTH rest',
    !(K5.pass2 && K5.pass2.paid > 0),
    `despawn+respawn with no rest: pass1 +${K5.pass1 && K5.pass1.paid}, pass2 +${K5.pass2 && K5.pass2.paid}, `
    + `pass3 +${K5.pass3 && K5.pass3.paid}; same eids reused: ${K5.same_eids}; ${K5.hearth_rests} rests; total ${K5.total}`);

  ok('K6 souls-consumption arm D can fail when the dummy cannot be spawned',
    R.K6.arm_d_would_pass === false,
    `spawn threw ("${R.K6.D && R.K6.D.error}") and arm D's predicate returns ${R.K6.arm_d_would_pass}`);
  ok('K7 souls-consumption arms B and I can fail when no kill happened',
    R.K7.arm_i_would_pass === false && R.K7.arm_b_would_pass === false,
    `arm I with 0 kills -> ${R.K7.arm_i_would_pass}; arm B with ${R.K7.arm_b_real_kills} real kills -> ${R.K7.arm_b_would_pass}`);

  ok('K4 the player is not swept into the kill scan',
    R.K4.player_in_entities === false,
    `sim.entities = ${JSON.stringify(R.K4.entity_ids)}; player present: ${R.K4.player_in_entities}`);

  out.verdicts = v;
  for (const r of v) say(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.detail}`);
  const bad = v.filter((r) => !r.pass).length;
  say(`\ncritic-souls-r1: ${v.length - bad}/${v.length} arms pass`);
  const dest = arg('out', 'reports/critic-souls-r1.json');
  fs.mkdirSync(path.dirname(path.join(ROOT, dest)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, dest), JSON.stringify(out, null, 2));
  say(`wrote ${dest}`);
  await handle.close();
  process.exit(bad === 0 ? 0 : 1);
} catch (e) {
  say(`critic-souls-r1: the instrument could not run — ${e.stack || e.message || e}`);
  out.instrument_error = String(e.message || e);
  try { fs.writeFileSync(path.join(ROOT, arg('out', 'reports/critic-souls-r1.json')), JSON.stringify(out, null, 2)); } catch { /* nothing */ }
  try { await handle.close(); } catch { /* gone */ }
  process.exit(2);
}
