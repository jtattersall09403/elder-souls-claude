#!/usr/bin/env node
// critic-w1-14-r2f.mjs — W1-14 round 2: THE GATE NO PROBE IN THIS PIECE EVER TOUCHES.
//
// Every magic probe in the tree (mag-probe, mag-census, mag-quest, and my own first two)
// begins its arena with `H.setMagicSkills({sorcery:100, root_speech:100, warding:100,
// veiling:100})`. This file does NOT. It plays the magic system at the skill the game itself
// gives you, and asks four questions:
//
//   1. What is the magic skill in a shipped state, with no harness call?
//   2. Which of the 72 shipped spells can be attuned at that skill?
//   3. Does anything a player can do — casting, resting at a HEARTH, levelling, the character
//      sheet — raise it? (RI-MTH07 §B2: perturb the model, watch the world.)
//   4. Is the failure silent? (`setAttuned` returning a shorter list than it was given.)
import path from 'node:path';
import { parseArgs, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-14-r2');
ensureDir(outDir);
const handle = await launchGame(args);
let R;
try {
  R = await handle.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready();
    const D = H.getMagicData();
    const spells = D.spells.spells;
    const out = {};

    const fresh = (state) => {
      H.setSeed(31); H.loadState(state || 'default'); H.setRenderRate(0);
      H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(5000000);
      H.hearthRest();
      for (const s of spells) H.learnSpell(s.id);      // buying spells is legal and free of skill
      H.magicEventsDrain();
    };

    // ---- 1 + 2: the attunable set, per shipped state, with NO setMagicSkills ---------------
    out.attunable = {};
    for (const state of ['default', 'arena_flat', 'dungeon_primary', 'helstrom-market']) {
      let err = null;
      try { fresh(state); } catch (e) { err = String(e.message); }
      if (err) { out.attunable[state] = { error: err }; continue; }
      const ok = [], refused = [];
      for (const s of spells) {
        const got = H.setAttuned([s.id]);
        (got.length ? ok : refused).push({ id: s.id, tier: s.tier, skill_req: s.skill_req, school: s.school });
      }
      out.attunable[state] = {
        attunable: ok.length, refused: refused.length, total: spells.length,
        refused_by_tier: refused.reduce((m, r) => (m[r.tier] = (m[r.tier] || 0) + 1, m), {}),
        refused_sample: refused.slice(0, 8).map((r) => `${r.id}(t${r.tier}/req${r.skill_req})`),
        // the silence: what setAttuned returns when it drops a spell
        silent_drop_example: (() => { const r = refused[0]; return r ? { asked: [r.id], returned: H.setAttuned([r.id]) } : null; })(),
      };
    }

    // ---- 3: does anything a player can do raise it? ----------------------------------------
    {
      fresh('default');
      const t3 = spells.find((s) => s.skill_req > 25);
      const probe = () => ({ attuned: H.setAttuned([t3.id]), quote_attunable: H.quoteSpell({ class: 'LIGHT', range: 'self', effects: [{ effect: 'shield', magnitude: 100, duration_s: 20, area_r_m: 0 }] }).attunable_now });
      const steps = {};
      steps.cold = probe();
      // cast 40 low-tier spells at a live target
      const low = spells.find((s) => s.skill_req <= 25 && s.class !== 'RITUAL');
      H.spawn('inf_trash', 0, 1.4);
      for (let i = 0; i < 40; i++) {
        H.setAttuned([low.id]); H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]); H.stepFrames(110);
        H.hearthRest();
        if (H.getCombatState().enemies.every((e) => e.dead)) H.spawn('inf_trash', 0, 1.4);
      }
      steps.after_40_casts = probe();
      H.hearthRest(); steps.after_hearth = probe();
      H.setSkills({ warding: 100, sorcery: 100, veiling: 100, 'root-speech': 100 });
      steps.after_setSkills_character_sheet = probe();
      H.grantSkillUse && (() => { try { H.grantSkillUse('cast_effective', { cost: 40, spell_skill: 'warding' }); } catch (e) { /* */ } })();
      steps.after_grantSkillUse = probe();
      H.setMagicSkills({ warding: 100, sorcery: 100, veiling: 100, root_speech: 100 });
      steps.after_setMagicSkills_harness_only = probe();
      out.raising = { tier3_spell: t3.id, low_spell: low.id, steps };
    }

    // ---- 4: spellmaking under the same gate -------------------------------------------------
    {
      fresh('default');
      const two = H.quoteSpell({ class: 'LIGHT', range: 'touch', effects: [
        { effect: 'fire_damage', magnitude: 20, duration_s: 0, area_r_m: 0 },
        { effect: 'paralyse', magnitude: 10, duration_s: 5, area_r_m: 0 },
      ] });
      const three = H.quoteSpell({ class: 'LIGHT', range: 'touch', effects: [
        { effect: 'fire_damage', magnitude: 20, duration_s: 0, area_r_m: 0 },
        { effect: 'paralyse', magnitude: 10, duration_s: 5, area_r_m: 0 },
        { effect: 'burden', magnitude: 20, duration_s: 5, area_r_m: 0 },
      ] });
      out.spellmaking_at_shipped_skill = { two_effects: { refused: two.refused, reason: two.reason || null }, three_effects: { refused: three.refused, reason: three.reason || null } };
    }
    return out;
  });
} finally { await handle.close(); }
writeJson(path.join(outDir, 'critic-skill-gate.json'), R);
for (const [k, v] of Object.entries(R.attunable)) log(k, JSON.stringify(v.error ? v : { attunable: v.attunable, refused: v.refused, by_tier: v.refused_by_tier }));
log('raising:', JSON.stringify(Object.fromEntries(Object.entries(R.raising.steps).map(([k, v]) => [k, { n: v.attuned.length, q: v.quote_attunable }]))));
log('spellmaking:', JSON.stringify(R.spellmaking_at_shipped_skill));
console.log(path.join(outDir, 'critic-skill-gate.json'));
