#!/usr/bin/env node
// critic-attr-scale-souls.mjs — re-measures trial C of tools/quests/attr-scale-consumption.mjs.
//
// ---------------------------------------------------------------------------------------------
// WHY
// ---------------------------------------------------------------------------------------------
// W1-ATTR-SCALE rests its entire band system on one claim, stated in its status file as
//
//     "THE BOUGHT ATTRIBUTE STREAM IS DEAD IN THE SHIPPED BUILD ... no kill, no quest, no loot
//      path awards souls ... IF ANY BUILDER WIRES KILL-SOULS, EVERY NUMBER IN THIS TASK MOVES."
//
// The only evidence for it is trial C of `attr-scale-consumption.mjs`, which prints
// `souls 0 -> 0 over 5 kill(s) of 42 entities` and passes in BOTH arms of the probe. It is an
// inert control, and its own shipped artifacts say so:
// `reports/attr-scale-consumption-{before,after}.json` record five entries of
// `{"error":"killEntity('undefined'): no such body"}`.
//
// `engine.listEntities()` rows carry `eid`, never `id`. So `e.id !== 'player'` filters nothing
// (undefined !== 'player' for every row, props and NPCs included, which is where "42 entities"
// comes from) and `H.killEntity(e.id)` becomes `killEntity('undefined')` every time. The verdict
// predicate is
//
//     D.kills.every((k) => k.error || k.souls_after === k.souls_before)
//
// so a thrown kill scores as a pass, and `D.kills.length > 0` is satisfied by five exceptions.
// The probe reported "5 kills" having killed nothing at all.
//
// ---------------------------------------------------------------------------------------------
// WHAT THIS DOES INSTEAD
// ---------------------------------------------------------------------------------------------
// ARM 1  spawn -> kill immediately -> step 60          the probe's shape, with the right key
// ARM 2  spawn -> step 60 -> kill -> step 60           the ledger has seen the body ALIVE first
//
// The two arms are not decoration. `SoulsSystem.step()` (game/src/sim/souls.js) pays only an
// alive->dead TRANSITION it has observed with its own eyes: a body whose first sight is already
// a corpse is recorded as settled and never paid. A probe that spawns and kills in the same
// evaluate() block, with no step in between, therefore under-reads even when it does kill.
//
// RED CONTROL: arm 3 disables the ledger (`sim.souls.enabled = false`) and repeats arm 2. If the
// award does not vanish, this instrument is measuring something other than the souls system and
// its numbers mean nothing.
//
// ---------------------------------------------------------------------------------------------
// EXIT
// ---------------------------------------------------------------------------------------------
// 0  the "no souls are awarded" claim HOLDS on this build (and the red control confirmed the
//    instrument could have seen an award if there had been one)
// 1  the claim is CONTRADICTED — souls were awarded — or the red control failed to go red
// 2  the instrument could not run
//
// Run: node tools/quests/critic-attr-scale-souls.mjs [--out reports/critic-attr-scale-souls.json]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };

const out = { tool: 'critic-attr-scale-souls', at: new Date().toISOString(), arms: {} };
const handle = await launchGame({ width: 320, height: 240 });
const page = handle.page;
let code = 2;
try {
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
  await page.evaluate(() => window.__HARNESS.setRenderRate && window.__HARNESS.setRenderRate(0));

  const r = await page.evaluate(() => {
    const H = window.__HARNESS;
    const res = {};
    const souls = () => H.getPlayerStats().souls;
    // `kind === 'enemy'` and `hp > 0`, from the documented shape of engine.listEntities():
    // enemies, NPCs and props all come back in one list and only enemies have a body to kill.
    const enemies = () => (H.listEntities() || []).filter((e) => e.kind === 'enemy' && e.hp > 0);

    const run = (label, { stepFirst, disableLedger }) => {
      const rec = { label, step_first: !!stepFirst, ledger_disabled: !!disableLedger };
      rec.souls_before = souls();
      rec.level_before = H.getPlayerStats().level;
      rec.souls_to_next = H.getPlayerStats().souls_to_next;
      let es = enemies();
      if (es.length < 3) {
        const p = H.getPlayerStats().position || { x: 0, z: 0 };
        try { H.spawnEncounter('dres-raid-party', p.x || 0, p.z || 0); } catch (e) { rec.spawn_error = String(e.message || e); }
        es = enemies();
      }
      rec.enemies_alive_before = es.length;
      if (stepFirst) H.stepFrames(60);
      rec.kills = [];
      for (const e of es.slice(0, 5)) {
        const b = souls();
        try { H.killEntity(e.eid); } catch (err) { rec.kills.push({ eid: e.eid, error: String(err.message || err) }); continue; }
        H.stepFrames(60);
        rec.kills.push({ eid: e.eid, archetype: e.archetype, souls_before: b, souls_after: souls() });
      }
      rec.real_kills = rec.kills.filter((k) => !k.error).length;
      rec.throws = rec.kills.filter((k) => k.error).length;
      rec.souls_after = souls();
      rec.awarded = rec.souls_after - rec.souls_before;
      return rec;
    };

    // The shape attr-scale-consumption uses, verbatim, so the difference is one thing only:
    // `e.id` vs `e.eid`. This is what the shipped probe would have reported had it used the key
    // the harness actually returns.
    res.probe_shape_with_the_wrong_key = (() => {
      const rec = { label: "attr-scale-consumption's own selector: e.id", kills: [] };
      const es = (H.listEntities() || []).filter((e) => e.id !== 'player');
      rec.entities_the_filter_kept = es.length;
      rec.entities_that_are_enemies = (H.listEntities() || []).filter((e) => e.kind === 'enemy').length;
      for (const e of es.slice(0, 5)) {
        try { H.killEntity(e.id); rec.kills.push({ killed: e.id }); }
        catch (err) { rec.kills.push({ error: String(err.message || err) }); }
      }
      rec.throws = rec.kills.filter((k) => k.error).length;
      return rec;
    })();

    res.arm1_kill_immediately = run('spawn -> kill immediately -> step 60 (the probe shape, right key)', { stepFirst: false });
    res.arm2_stepped_first = run('spawn -> step 60 -> kill -> step 60', { stepFirst: true });

    // RED CONTROL. Turn the ledger off and repeat arm 2. If souls still move, this probe is not
    // measuring the souls system.
    const E = H.__engine || window.__ENGINE || null;
    if (E && E.sim && E.sim.souls) {
      E.sim.souls.enabled = false;
      res.arm3_red_control = run('RED CONTROL: sim.souls.enabled = false, then arm 2 again', { stepFirst: true, disableLedger: true });
      E.sim.souls.enabled = true;
    } else {
      res.arm3_red_control = { label: 'RED CONTROL', not_run_reason: 'the engine is not reachable from the harness surface; sim.souls.enabled could not be toggled' };
    }
    return res;
  });

  out.arms = r;
  const a1 = r.arm1_kill_immediately, a2 = r.arm2_stepped_first, a3 = r.arm3_red_control;
  const awarded = (a1.awarded || 0) + (a2.awarded || 0);
  const realKills = (a1.real_kills || 0) + (a2.real_kills || 0);

  const say = (s) => console.log(s);
  say(`THE SHIPPED PROBE'S SELECTOR: kept ${r.probe_shape_with_the_wrong_key.entities_the_filter_kept} rows ` +
      `(${r.probe_shape_with_the_wrong_key.entities_that_are_enemies} are enemies), ` +
      `${r.probe_shape_with_the_wrong_key.throws}/5 killEntity calls threw.`);
  say('');
  for (const a of [a1, a2, a3]) {
    if (!a || a.not_run_reason) { say(`NOT RUN  ${a && a.label}: ${a && a.not_run_reason}`); continue; }
    say(`${a.label}`);
    say(`         real kills ${a.real_kills}, throws ${a.throws}, souls ${a.souls_before} -> ${a.souls_after} (awarded ${a.awarded})`);
    for (const k of a.kills) say(`           ${k.error ? 'THREW ' + k.error : `${k.eid}  ${k.souls_before} -> ${k.souls_after}`}`);
  }
  say('');

  const redWentRed = a3 && !a3.not_run_reason ? (a3.awarded === 0 && a3.real_kills > 0) : null;
  out.summary = { real_kills: realKills, souls_awarded: awarded, red_control_went_red: redWentRed, souls_to_next_level: a1.souls_to_next };

  if (realKills === 0) {
    say('INCONCLUSIVE: no entity was actually killed. The claim cannot be tested from this run.');
    code = 2;
  } else if (awarded > 0) {
    say(`CONTRADICTED. ${realKills} real kills awarded ${awarded} souls on this build. The claim that`);
    say('"nothing awards souls" and that the bought attribute stream is unfundable does NOT hold.');
    say(`game/src/sim/souls.js pays on the alive->dead transition; the next level costs ${a1.souls_to_next}.`);
    if (redWentRed === false) say('AND THE RED CONTROL DID NOT GO RED — treat every number above as unproven.');
    code = 1;
  } else if (redWentRed === false) {
    say('VOID: no souls were awarded, but the red control did not go red either, so this instrument');
    say('cannot tell "nothing awards souls" from "this probe cannot see an award".');
    code = 1;
  } else {
    say(`HOLDS: ${realKills} real kills awarded 0 souls, and the red control went red, so the`);
    say('instrument could have seen an award had there been one.');
    code = 0;
  }

  const dest = arg('out', null);
  if (dest) {
    const p = path.join(ROOT, dest);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(out, null, 2));
    say(`wrote ${dest}`);
  }
} finally {
  await handle.close();
}
process.exit(code);
