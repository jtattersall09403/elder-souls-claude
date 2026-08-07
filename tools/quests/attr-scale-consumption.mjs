#!/usr/bin/env node
// attr-scale-consumption.mjs — the CONSUMPTION probe for the attribute-scale sweep.
// RI-MTH07 §B, mandatory under ARBITRATION.md §3.
//
// The claim this piece makes is a claim about the RUNNING WORLD, not about JSON: that a demand
// written on Morrowind's 0-100 attribute scale, or on a skill id with the wrong punctuation,
// produces a gate that no amount of play can move. Reading `canResolve()` proves nothing — the
// question is what the shipped `QuestEngine.resolutionsFor()` says when the character is standing
// there with the best sheet the game can produce.
//
// So each claim is exercised by PERTURBING THE CHARACTER inside the live engine and watching the
// gate's own `why` string move or refuse to:
//
//   A. THE DEAD KEY. Set `root-speech` to 100 — the register's real id, the maximum a player can
//      ever reach — and read Q-LILM-01 res_rootkeepers. It must still refuse, and the refusal must
//      still say 0/45, because `requires.skills` names `root_speech` and the lookup is verbatim.
//      Then set the misspelt key itself and watch the gate open, which identifies the lookup as
//      the mechanism rather than the difficulty. NULL CONTROL: Q-DEEP-01's correctly-spelt
//      `speechcraft` floor in the same resolution set must respond to the same poke.
//
//   B. THE OFF-SCALE ATTRIBUTE. Set personality to 31 — the ceiling of the best of 240 sheets,
//      measured — and read Q-BLAK-01 res_hold. It must refuse at 31/45. Then set it to the
//      demand and watch it open. Two well-separated values, everything else fixed.
//
//   C. THE SECOND STREAM IS DEAD. The ceiling in B is only the ceiling because nothing awards
//      souls. Kill an entity and read `soulsHeld`; if it is still 0, the bought stream has no
//      source and every ceiling this piece rests on is a ceiling of the shipped build.
//
// Run: node tools/quests/attr-scale-consumption.mjs [--out reports/attr-scale-consumption.json]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };

// --after flips every expectation. Same probe, same pokes, same world: BEFORE the fix the gate
// must be immovable, AFTER it must respond. Running only one half proves nothing, because a gate
// that is always open passes the "after" half on its own.
const AFTER = process.argv.includes('--after');
const out = { tool: 'attr-scale-consumption', mode: AFTER ? 'after' : 'before', at: new Date().toISOString(), trials: [], couplings: {} };
const say = (s) => console.log(s);

const handle = await launchGame({ width: 320, height: 240 });
const page = handle.page;
try {
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
  await page.evaluate(() => window.__HARNESS.setRenderRate && window.__HARNESS.setRenderRate(0));

  const probe = await page.evaluate(() => {
    const H = window.__HARNESS;
    const res = [];
    // A REAL CHARACTER, not a bare sim. Before the Writ House the engine carries a placeholder
    // SIX-attribute Souls sheet (vigour/endurance/strength/dexterity/intelligence/faith) and
    // `personality` does not exist at all — which is its own way for a social gate to read 0/45.
    // This is the signature the faction probe uses, so the sheet is one a player can be handed.
    H.setCharacter({ race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' });
    res.push({ name: 'the sheet under test', attributes: H.getCharacter().attributes, skills: H.getCharacter().skills });
    const read = (q, r) => {
      const rows = H.questResolutions(q);
      const row = rows.find((x) => x.id === r);
      return row ? { available: row.available, why: row.why.slice() } : { available: null, why: ['NO SUCH RESOLUTION'] };
    };

    // ---- A. the dead skill key ---------------------------------------------------------------
    const A = { name: 'dead skill key: Q-LILM-01 res_rootkeepers requires root_speech 45' };
    A.declared = H.questResolutionRequirements('Q-LILM-01', 'res_rootkeepers');
    H.setSkills({ 'root-speech': 5 });
    A.at_skill_5 = read('Q-LILM-01', 'res_rootkeepers');
    H.setSkills({ 'root-speech': 100 });               // the maximum any player can ever reach
    A.at_real_key_100 = read('Q-LILM-01', 'res_rootkeepers');
    H.setSkills({ root_speech: 100 });                 // the misspelt key the data actually names
    A.at_misspelt_key_100 = read('Q-LILM-01', 'res_rootkeepers');
    H.setSkills({ root_speech: 0 });
    res.push(A);

    // NULL CONTROL: a correctly-spelt floor in the same shape must respond to the same poke.
    const C = { name: 'NULL CONTROL: Q-DEEP-01 res_broker speechcraft 45 (correctly spelt)' };
    C.declared = H.questResolutionRequirements('Q-DEEP-01', 'res_broker');
    H.setSkills({ speechcraft: 5 });
    C.at_5 = read('Q-DEEP-01', 'res_broker');
    H.setSkills({ speechcraft: 100 });
    C.at_100 = read('Q-DEEP-01', 'res_broker');
    res.push(C);

    // ---- B. the off-scale attribute ----------------------------------------------------------
    const B = { name: 'off-scale attribute: Q-BLAK-01 res_hold requires personality 45' };
    B.declared = H.questResolutionRequirements('Q-BLAK-01', 'res_hold');
    H.setAttributes({ personality: 10 });
    B.at_10 = read('Q-BLAK-01', 'res_hold');
    H.setAttributes({ personality: 31 });   // reachable_ceiling.from_max, the best of 240 sheets
    B.at_measured_ceiling_31 = read('Q-BLAK-01', 'res_hold');
    H.setAttributes({ personality: 45 });   // the demand itself — unreachable by any real sheet
    B.at_the_demand_45 = read('Q-BLAK-01', 'res_hold');
    H.setAttributes({ personality: 10 });
    res.push(B);

    // ---- C. is the bought stream alive? -------------------------------------------------------
    const D = { name: 'the bought attribute stream: does anything award souls?' };
    D.before = H.getPlayerStats ? { souls: H.getPlayerStats().souls } : null;
    D.level_before = H.getPlayerStats().level;
    D.souls_to_next = H.getPlayerStats().souls_to_next;
    D.kills = [];
    // The world at boot has no hostiles standing in it, so one is SPAWNED. A soul source that
    // only fires for enemies the probe could not reach would still be a source; this removes
    // that escape by putting a real encounter in front of the player and killing it.
    try {
      const ps = H.getPlayerStats();
      D.player_pos = ps.position || null;
      const p0 = ps.position || { x: 0, z: 0 };
      try { H.spawnEncounter('dres-raid-party', p0.x || 0, p0.z || 0); } catch (e1) { D.spawn_error_1 = String(e1.message || e1); }
      let ents = (H.listEntities() || []).filter((e) => e.id !== 'player');
      if (!ents.length) { try { H.spawnEncounter('deep-kin-war-brood', p0.x || 0, p0.z || 0); } catch (e2) { D.spawn_error_2 = String(e2.message || e2); } }
      ents = (H.listEntities() || []).filter((e) => e.id !== 'player');
      D.entities_seen = ents.length;
      for (const e of ents.slice(0, 5)) {
        const before = H.getPlayerStats().souls;
        try { H.killEntity(e.id); } catch (err) { D.kills.push({ id: e.id, error: String(err.message || err) }); continue; }
        try { H.stepFrames(60); } catch (err) { D.step_error = String(err.message || err); }
        D.kills.push({ id: e.id, souls_before: before, souls_after: H.getPlayerStats().souls });
      }
    } catch (e) { D.kill_error = String(e.message || e); }
    D.level_after = H.getPlayerStats().level;
    D.after = H.getPlayerStats ? { souls: H.getPlayerStats().souls } : null;
    res.push(D);

    return res;
  });

  out.trials = probe;

  // ---- verdicts -----------------------------------------------------------------------------
  const [, A, C, B, D] = probe;
  const v = [];
  const ok = (name, cond, detail) => { v.push({ name, pass: !!cond, detail }); return !!cond; };

  if (!AFTER) {
    ok('A1 the dead key refuses at the maximum a player can reach',
      A.at_real_key_100.available === false && A.at_real_key_100.why.some((w) => /root_speech 0\/45/.test(w)),
      A.at_real_key_100.why.join(' | '));
    ok('A2 the gate is unmoved between root-speech 5 and root-speech 100 (coupling = 0)',
      JSON.stringify(A.at_skill_5.why) === JSON.stringify(A.at_real_key_100.why),
      `${A.at_skill_5.why.join('|')}  ==  ${A.at_real_key_100.why.join('|')}`);
    ok('A3 setting the MISSPELT key itself opens it — the lookup is the mechanism, not the difficulty',
      A.at_misspelt_key_100.available === true || !A.at_misspelt_key_100.why.some((w) => /root_speech/.test(w)),
      A.at_misspelt_key_100.why.join(' | '));
  } else {
    ok('A1 (after) the skill floor now names a skill the register has',
      A.at_skill_5.why.some((w) => /root-speech 5\/45/.test(w)),
      A.at_skill_5.why.join(' | '));
    ok('A2 (after) the gate MOVES between root-speech 5 and root-speech 100 — coupling is no longer 0',
      JSON.stringify(A.at_skill_5.why) !== JSON.stringify(A.at_real_key_100.why) &&
      !A.at_real_key_100.why.some((w) => /root-?[_-]speech/.test(w)),
      `${A.at_skill_5.why.join('|')}  ->  ${A.at_real_key_100.why.join('|')}`);
    ok('A3 (after) the misspelt key now does nothing, because nothing reads it',
      A.at_misspelt_key_100.why.some((w) => /root-speech/.test(w)) === false ||
      JSON.stringify(A.at_misspelt_key_100.why) === JSON.stringify(A.at_real_key_100.why),
      A.at_misspelt_key_100.why.join(' | '));
  }
  ok('CONTROL a correctly-spelt floor DOES respond to the same poke (coupling != 0)',
    C.at_5.why.join('|') !== C.at_100.why.join('|'),
    `${C.at_5.why.join('|')}  ->  ${C.at_100.why.join('|')}`);
  ok(AFTER
      ? 'B1 (after) a reachable sheet clears the personality gate: no personality term left in the refusal'
      : 'B1 personality at the measured ceiling of the best of 240 sheets still refuses',
    AFTER
      ? !B.at_measured_ceiling_31.why.some((w) => /personality/.test(w))
      : (B.at_measured_ceiling_31.available === false && B.at_measured_ceiling_31.why.some((w) => /personality 31\/45/.test(w))),
    B.at_measured_ceiling_31.why.join(' | '));
  ok(AFTER ? 'B2 (after) a floor sheet at personality 10 STILL cannot take it — the gate is not vacuous' : 'B2 the gate DOES move when the attribute does — so it is a scale bug, not a dead gate',
    AFTER ? B.at_10.why.some((w) => /personality 10\/16/.test(w)) : B.at_10.why.join('|') !== B.at_measured_ceiling_31.why.join('|'),
    `${B.at_10.why.join('|')}  ->  ${B.at_measured_ceiling_31.why.join('|')}`);
  ok(AFTER ? 'B3 (after) still open at the old off-scale value (monotone gate, sanity)' : 'B3 it opens only at a value no character can hold',
    B.at_the_demand_45.available === true || !B.at_the_demand_45.why.some((w) => /personality/.test(w)),
    B.at_the_demand_45.why.join(' | '));
  ok('C the bought stream has no source: killing everything in the world awards no souls',
    D.before && D.after && D.after.souls === D.before.souls && D.after.souls === 0 && (D.kills || []).length > 0
      && D.kills.every((k) => k.error || k.souls_after === k.souls_before),
    `souls ${D.before && D.before.souls} -> ${D.after && D.after.souls} over ${(D.kills || []).length} kill(s) ` +
    `of ${D.entities_seen} entities; the next level costs ${D.souls_to_next} and the player is level ${D.level_before}`);

  out.verdicts = v;
  for (const r of v) say(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.detail}`);
  const bad = v.filter((r) => !r.pass).length;
  say(`\nattr-scale-consumption: ${v.length - bad}/${v.length}`);

  const dest = arg('out', null);
  if (dest) { fs.mkdirSync(path.dirname(path.join(ROOT, dest)), { recursive: true }); fs.writeFileSync(path.join(ROOT, dest), JSON.stringify(out, null, 2)); say(`wrote ${dest}`); }
  process.exitCode = bad ? 1 : 0;
} finally {
  await handle.close();
}
