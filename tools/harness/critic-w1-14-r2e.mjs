#!/usr/bin/env node
// critic-w1-14-r2e.mjs — W1-14 round 2: does a REAL character's magic skill rise by casting,
// and does it reach (a) the magic system's own gates and (b) the quest resolution gate?
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
    const out = {};
    const cast = (sid, f) => { H.setAttuned([sid]); H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]); H.stepFrames(f || 130); };
    const quote = () => H.quoteSpell({ class: 'LIGHT', range: 'self', effects: [{ effect: 'shield', magnitude: 100, duration_s: 20, area_r_m: 0 }] });

    H.setSeed(21); H.loadState('default'); H.setRenderRate(0);
    out.creation_data_skills = Object.keys(H.getCreationData ? (H.getCreationData().skills || {}) : {}).slice(0, 30);
    // Compose a caster the way a scenario does.
    let made = null;
    try { made = H.setCharacter({ race: 'saxhleel', birthsign: 'the_hist_mother', origin: 'marsh_born', vocation: 'sap_speaker' }); } catch (e) { made = { error: String(e.message) }; }
    out.setCharacter = made && made.error ? made : { ok: true };
    out.sheet_after_setCharacter = H.getSkillSheet();
    out.character = H.getCharacter ? (() => { const c = H.getCharacter(); return { race: c.race, vocation: c.vocation, skills: c.skills }; })() : null;

    // Now cast, a lot, and see whether the sheet moves.
    H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(2000000); H.hearthRest();
    for (const s of D.spells.spells) H.learnSpell(s.id);
    const fire = D.spells.spells.find((s) => s.effects.some((t) => t.effect === 'fire_damage') && s.class !== 'RITUAL');
    const ward = D.spells.spells.find((s) => s.school === 'warding' && s.class !== 'RITUAL' && s.range === 'self');
    H.spawn('inf_trash', 0, 1.4);
    const before = JSON.parse(JSON.stringify(H.getSkillSheet()));
    const quote0 = quote();
    let events = 0;
    H.traceStart && H.traceStart();
    for (let i = 0; i < 30; i++) {
      cast(fire.id, 120); H.hearthRest();
      if (H.getCombatState().enemies.every((e) => e.dead)) H.spawn('inf_trash', 0, 1.4);
    }
    const midSheet = JSON.parse(JSON.stringify(H.getSkillSheet()));
    for (let i = 0; i < 30; i++) { cast(ward ? ward.id : fire.id, 120); H.hearthRest(); }
    const afterSheet = JSON.parse(JSON.stringify(H.getSkillSheet()));
    const tr = H.traceDrain ? H.traceDrain() : null;
    let skillUseEvents = [];
    if (tr && tr.frames) {
      for (const f of tr.frames) for (const e of (f.events || [])) if (e.kind === 'skill_use' || e.type === 'skill_use') skillUseEvents.push(e);
    }
    out.by_use = {
      sheet_before: before, sheet_after_30_sorcery: midSheet, sheet_after_30_more_warding: afterSheet,
      ward_spell: ward ? ward.id : null, fire_spell: fire.id,
      skill_use_events: skillUseEvents.slice(0, 12), skill_use_event_count: skillUseEvents.length,
      quote_before: { skill_req: quote0.skill_req, attunable_now: quote0.attunable_now, focus_cost: quote0.focus_cost },
      quote_after: (() => { const q = quote(); return { skill_req: q.skill_req, attunable_now: q.attunable_now, focus_cost: q.focus_cost }; })(),
    };
    // The quest gate, read against the same sheet.
    out.quest_context_skills = (() => {
      const res = H.questResolutionRequirements('Q-MAG-01', 'mag_the_warded_ledger__magic');
      let open = H.questOpen('Q-MAG-01');
      const r = H.questResolutions('Q-MAG-01').find((x) => x.method === 'magic_utility');
      return { requires: res.skills, open, gate: r };
    })();
    return out;
  });
} finally { await handle.close(); }
writeJson(path.join(outDir, 'critic-skill-by-use.json'), R);
log('sheet after setCharacter keys:', Object.keys(R.sheet_after_setCharacter || {}).join(',') || '(empty)');
log('by_use quote:', JSON.stringify(R.by_use.quote_before), '->', JSON.stringify(R.by_use.quote_after));
log('skill_use events:', R.by_use.skill_use_event_count);
log('gate:', JSON.stringify(R.quest_context_skills.gate));
console.log(path.join(outDir, 'critic-skill-by-use.json'));
