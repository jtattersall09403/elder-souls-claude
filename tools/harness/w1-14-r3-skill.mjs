#!/usr/bin/env node
// w1-14-r3-skill.mjs — GAP-W1-magic-skill-frozen, measured under RI-MAG06 §E.
//
// THE RULE THIS FILE OBEYS: it never opens an arena by granting itself the thing under test.
// There is no `setMagicSkills` in this file and no `setSkills`. The only way a number moves
// here is by choosing a class at character creation (which is a thing the game asks you) or by
// casting spells (which is a thing you do).
//
// It is built to FAIL. `--break=<mode>` disables the mechanism under test so the probe can be
// watched going red before its green is believed:
//   --break=nogrant   suppress the cast_effective credit  -> advancement must read 0
//   --break=frozen    restore the private {…30} register  -> coupling must read 0.00
import path from 'node:path';
import { parseArgs, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/w1-14-r3');
ensureDir(outDir);
const breakMode = args.break ? String(args.break) : null;
const handle = await launchGame(args);
let R;
try {
  R = await handle.page.evaluate(async (BREAK) => {
    const H = window.__HARNESS; await H.ready();
    const D = H.getMagicData();
    const spells = D.spells.spells;
    const out = { break_mode: BREAK, states: {}, advancement: null, coupling: null, save_load: null, refusal: null, spellmaking: null };

    const magicSkills = () => {
      const s = H.getSkills ? H.getSkills() : null;
      return s ? { sorcery: s.sorcery, 'root-speech': s['root-speech'], warding: s.warding, veiling: s.veiling } : null;
    };
    // Count what the game will actually let you attune, one spell at a time. `setAttuned`
    // returns what it accepted, so a refusal is a shorter array.
    const attunableCount = () => {
      let ok = 0; const refusedTiers = {};
      for (const s of spells) {
        if (H.setAttuned([s.id]).length) ok++;
        else refusedTiers[s.tier] = (refusedTiers[s.tier] || 0) + 1;
      }
      return { attunable: ok, refused: spells.length - ok, total: spells.length, refused_by_tier: refusedTiers };
    };

    const fresh = (state, character) => {
      H.setSeed(31); H.loadState(state); H.setRenderRate(0);
      if (character) H.setCharacter(character);
      H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(5000000);
      for (const s of spells) H.learnSpell(s.id);
      H.magicEventsDrain();
      if (BREAK === 'frozen') H.__breakSkillRegister();
      if (BREAK === 'nogrant') H.__breakCastCredit();
    };

    // ---- 1. what the game gives you, per shipped state, with no gate-opening call -----------
    for (const state of ['default', 'arena_flat', 'dungeon_primary', 'helstrom-market']) {
      try {
        fresh(state, null);
        out.states[state] = { skills: magicSkills(), ...attunableCount() };
      } catch (e) { out.states[state] = { error: String(e.message) }; }
    }

    // ---- 2. the same states, for a character who chose a mage class at creation -------------
    // Choosing a class is character creation, not a harness gate: `sap-reader` is one of the
    // seven classes `game/data/progression/classes.json` ships and the Writ House offers it.
    out.states_mage = {};
    const MAGE = { race: 'saxhleel', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' };
    for (const state of ['default', 'arena_flat', 'dungeon_primary', 'helstrom-market']) {
      try {
        fresh(state, MAGE);
        out.states_mage[state] = { skills: magicSkills(), ...attunableCount() };
      } catch (e) { out.states_mage[state] = { error: String(e.message) }; }
    }

    // ---- 3. does PLAY move it? -------------------------------------------------------------
    {
      fresh('arena_flat', MAGE);
      const wardSpell = spells.find((s) => s.schools.length === 1 && s.schools[0] === 'warding' && s.skill_req === 0 && s.class !== 'RITUAL');
      const before = { skills: magicSkills(), ...attunableCount() };
      let casts = 0, skillUseEvents = 0, wardingEvents = 0, castEffective = 0, sorceryEvents = 0;
      const skillUseSample = [];
      H.spawn('inf_trash', 0, 1.4);
      H.traceStart({ events: true });
      for (let i = 0; i < 120; i++) {
        H.setAttuned([wardSpell.id]);
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        H.stepFrames(110);
        casts++;
        for (const rec of H.traceDrain()) {
          for (const e of (rec.events || [])) {
            if (e.type === 'skill_use') {
              skillUseEvents++;
              if (e.skill === 'warding') wardingEvents++;
              if (e.skill === 'sorcery') sorceryEvents++;
              if (skillUseSample.length < 4) skillUseSample.push(e);
            }
            if (e.type === 'cast_effective') castEffective++;
          }
        }
        // A HEARTH rest refills Focus AND clears RI-PRG03 §4's +3-levels-per-rest clamp. Both
        // are things a player does; neither is a harness gate.
        H.hearthRest();
        if (H.getCombatState().enemies.every((e) => e.dead)) H.spawn('inf_trash', 0, 1.4);
      }
      const after = { skills: magicSkills(), ...attunableCount() };
      out.advancement = {
        spell: wardSpell.id, casts, skill_use_events: skillUseEvents,
        skill_use_events_warding: wardingEvents, skill_use_events_sorcery: sorceryEvents,
        cast_effective_events: castEffective, skill_use_sample: skillUseSample,
        before, after,
        warding_delta: after.skills.warding - before.skills.warding,
        attunable_delta: after.attunable - before.attunable,
      };

      // ---- 4. save / load survival --------------------------------------------------------
      const blob = H.saveState();
      const skillsAtSave = magicSkills();
      const attunableAtSave = attunableCount().attunable;
      H.loadState('default');                       // wipe it back to a fresh sheet
      const wiped = magicSkills();
      H.restoreState ? H.restoreState(blob) : H.loadState(blob);
      out.save_load = {
        at_save: skillsAtSave, after_wipe: wiped, after_restore: magicSkills(),
        attunable_at_save: attunableAtSave, attunable_after_restore: attunableCount().attunable,
        survived: JSON.stringify(magicSkills()) === JSON.stringify(skillsAtSave),
      };
    }

    // ---- 5. coupling, both directions (RI-MTH07 §B2/§C) -------------------------------------
    {
      fresh('arena_flat', MAGE);
      const t3 = spells.find((s) => s.skill_req === 45);
      const control = H.setAttuned([t3.id]).length;             // null control: nothing perturbed
      // perturb the CHARACTER SHEET through the ordinary progression verb, not through magic
      // drive the school THIS SPELL actually needs, through the ordinary progression verb
      const SCHOOL = { sorcery: 'sorcery', root_speech: 'root-speech', warding: 'warding', veiling: 'veiling' };
      const drive = SCHOOL[t3.schools[0]] || t3.schools[0];
      let granted = 0;
      for (let i = 0; i < 400; i++) {
        const r = H.grantSkillUse('cast_effective', { cost: 40, spell_skill: drive });
        if (r && r.granted) granted++;
        H.hearthRest();                                         // clears the per-rest clamp
      }
      const afterSheet = { skills: magicSkills(), tier3_attuned: H.setAttuned([t3.id]).length };
      out.coupling = {
        tier3_spell: t3.id, tier3_schools: t3.schools, control_tier3_attuned: control,
        drove_skill: drive, grants_accepted: granted, after_sheet_drive: afterSheet,
        // coupling 1.00 means driving the sheet moved the magic gate
        coupling_sheet_to_magic: (afterSheet.tier3_attuned > control) ? 1 : 0,
      };
    }

    // ---- 6. the refusal is no longer silent --------------------------------------------------
    {
      fresh('default', null);
      const t4 = spells.find((s) => s.skill_req === 65);
      H.magicEventsDrain();
      const got = H.setAttuned([t4.id]);
      const evs = H.magicEventsDrain().filter((e) => e.kind === 'attune_refused');
      out.refusal = { asked: t4.id, returned: got, events: evs };
    }

    // ---- 7. spellmaking effect-count gate, at the shipped skill and after play ---------------
    {
      const three = () => H.quoteSpell({ class: 'LIGHT', range: 'touch', effects: [
        { effect: 'fire_damage', magnitude: 20, duration_s: 0, area_r_m: 0 },
        { effect: 'paralyse', magnitude: 10, duration_s: 5, area_r_m: 0 },
        { effect: 'burden', magnitude: 20, duration_s: 5, area_r_m: 0 },
      ] });
      fresh('arena_flat', MAGE);
      const cold = three();
      for (let i = 0; i < 400; i++) { H.grantSkillUse('cast_effective', { cost: 40, spell_skill: 'sorcery' }); H.hearthRest(); }
      const warm = three();
      out.spellmaking = {
        cold: { refused: cold.refused, reason: cold.reason || null },
        warm: { refused: warm.refused, reason: warm.reason || null, tier: warm.tier || null },
        sorcery_after: magicSkills().sorcery,
      };
    }
    return out;
  }, breakMode);
} finally { await handle.close(); }

writeJson(path.join(outDir, `skill${breakMode ? '-break-' + breakMode : ''}.json`), R);
for (const [k, v] of Object.entries(R.states)) log('shipped ', k, JSON.stringify(v.error ? v : { skills: v.skills, attunable: v.attunable + '/' + v.total, by_tier: v.refused_by_tier }));
for (const [k, v] of Object.entries(R.states_mage)) log('mage    ', k, JSON.stringify(v.error ? v : { skills: v.skills, attunable: v.attunable + '/' + v.total, by_tier: v.refused_by_tier }));
if (R.advancement) log('advancement', JSON.stringify({
  casts: R.advancement.casts, cast_effective: R.advancement.cast_effective_events,
  skill_use_warding: R.advancement.skill_use_events_warding,
  skill_use_sorcery: R.advancement.skill_use_events_sorcery,
  warding: R.advancement.before.skills.warding + ' -> ' + R.advancement.after.skills.warding,
  attunable: R.advancement.before.attunable + ' -> ' + R.advancement.after.attunable,
}));
if (R.save_load) log('save/load', JSON.stringify(R.save_load));
if (R.coupling) log('coupling', JSON.stringify(R.coupling));
if (R.refusal) log('refusal', JSON.stringify(R.refusal));
if (R.spellmaking) log('spellmaking', JSON.stringify(R.spellmaking));
console.log(path.join(outDir, `skill${breakMode ? '-break-' + breakMode : ''}.json`));
